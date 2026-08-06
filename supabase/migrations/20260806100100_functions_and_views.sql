-- =============================================================================
-- R-Tech 管理システム — 関数・ビュー・整合性トリガー
--
-- ドメインルールのうち「破られると金額や割り当てが壊れるもの」は
-- アプリ側ではなく DB 側で担保する。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 認証ヘルパー（RLS から使う。users を参照するため security definer で再帰を避ける）
-- -----------------------------------------------------------------------------

create or replace function public.auth_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid() and active;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- -----------------------------------------------------------------------------
-- 学年（保存せず計算する。CLAUDE.md ドメインルール8）
-- -----------------------------------------------------------------------------

-- 年度は4月始まり。1〜3月は前年度として扱う。
create or replace function public.academic_year(at date)
returns smallint
language sql immutable
as $$
  select (case
            when extract(month from at) >= 4 then extract(year from at)
            else extract(year from at) - 1
          end)::smallint;
$$;

-- 学年 = 年度 − enrollment_year + 1 （小1=1 .. 小6=6、中1=7 .. 中3=9）
create or replace function public.student_grade(p_enrollment_year smallint, at date)
returns smallint
language sql immutable
as $$
  select (public.academic_year(at) - p_enrollment_year + 1)::smallint;
$$;

comment on function public.student_grade(smallint, date) is
  '学年を計算する。学年カラムは持たない（毎年の一括更新が漏れると全生徒の料金が狂うため）。';

-- -----------------------------------------------------------------------------
-- 締め切り（行が無い年月は「受付未開放」= 提出不可）
-- -----------------------------------------------------------------------------

create or replace function public.is_submission_open(
  p_year_month text,
  p_type       public.deadline_type
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select d.active and now() < d.deadline_at
       from public.deadlines d
      where d.year_month = p_year_month and d.type = p_type),
    false
  );
$$;

comment on function public.is_submission_open(text, public.deadline_type) is
  '締め切り行が無い年月、active=false の年月は false（未開放）を返す。行は deadline_rules から自動生成される。';

-- -----------------------------------------------------------------------------
-- 締め切りの自動生成（deadline_rules → deadlines）
--
-- 対象月の前月1日に、その月ぶんの行を作る。ルールを直接評価せず行を作るのは、
-- 判定側（is_submission_open と RLS）を「その月の行があるか」だけで済ませたいため。
-- 例外（特定月だけ日付を変える・受け付けない）は、できた行を直接いじって対応する。
-- 既にある行は上書きしない ― 管理者が個別に動かした日付を戻してしまうため。
-- -----------------------------------------------------------------------------

create or replace function public.generate_deadlines(p_year_month text default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_target date;
  v_prev   date;
  v_rule   record;
  v_day    smallint;
  v_count  integer := 0;
begin
  -- 引数が無ければ「翌月ぶん」を作る（毎月1日に実行する想定）
  v_target := coalesce(to_date(p_year_month || '-01', 'YYYY-MM-DD'),
                       date_trunc('month', current_date)::date + interval '1 month');
  v_prev   := (v_target - interval '1 month')::date;

  for v_rule in select * from public.deadline_rules where active loop
    -- 月末を超える指定はその月の末日に丸める
    v_day := least(v_rule.day_of_month,
                   extract(day from (date_trunc('month', v_prev)
                                     + interval '1 month - 1 day'))::smallint);

    insert into public.deadlines (year_month, type, deadline_at)
    values (
      to_char(v_target, 'YYYY-MM'),
      v_rule.type,
      (date_trunc('month', v_prev) + make_interval(days => v_day - 1) + v_rule.time_of_day)
        at time zone 'Asia/Tokyo'
    )
    on conflict (year_month, type) do nothing;   -- 既存の行は動かさない

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.generate_deadlines(text) is
  '対象月の前月1日に pg_cron から呼ぶ。既存行は上書きしない（管理者が動かした日付を戻さないため）。';

-- -----------------------------------------------------------------------------
-- 予約投稿したお知らせの送信（scheduled_at を過ぎたものに sent_at を入れる）
-- -----------------------------------------------------------------------------

create or replace function public.send_due_announcements()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.announcements
     set sent_at = now()
   where sent_at is null
     and scheduled_at is not null
     and scheduled_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.send_due_announcements() is
  'pg_cron から数分おきに呼ぶ。sent_at が入ると RLS の条件を満たして対象者に見えるようになる。';

-- -----------------------------------------------------------------------------
-- 受講希望の整合性チェック
--   1. year_month と session_date の月が一致すること
--   2. その生徒の在籍事業で、その曜日・コマが実際に開催されていること
--   3. コースの月間回数上限を超えないこと
-- -----------------------------------------------------------------------------

create or replace function public.validate_preference()
returns trigger
language plpgsql
as $$
declare
  v_limit smallint;
  v_count smallint;
begin
  if to_char(new.session_date, 'YYYY-MM') <> new.year_month then
    raise exception '対象年月(%)と希望日(%)の月が一致しません', new.year_month, new.session_date;
  end if;

  if not exists (
    select 1
      from public.students s
      join public.business_slots bs on bs.business_id = s.business_id
     where s.id = new.student_id
       and bs.weekday = extract(dow from new.session_date)::smallint
       and bs.slot_no = new.slot_no
       and bs.active
  ) then
    raise exception '在籍事業では % の第%コマは開催されていません', new.session_date, new.slot_no;
  end if;

  select c.sessions_per_month into v_limit
    from public.students s
    join public.courses c on c.id = s.course_id
   where s.id = new.student_id;

  select count(*) into v_count
    from public.preferences p
   where p.student_id = new.student_id
     and p.year_month = new.year_month;

  if v_count > v_limit then
    raise exception '受講希望が上限を超えています（上限 %コマ / 選択 %コマ）', v_limit, v_count;
  end if;

  return new;
end;
$$;

-- AFTER にすることで、上限チェックの件数に自分自身を含められる
create trigger preferences_validate
  after insert or update on public.preferences
  for each row execute function public.validate_preference();

-- -----------------------------------------------------------------------------
-- 勤務希望の整合性チェック（年月の一致・開催枠の存在）
--   ※ 担当できない事業に出せないことは複合外部キーで既に担保済み
-- -----------------------------------------------------------------------------

create or replace function public.validate_work_preference()
returns trigger
language plpgsql
as $$
begin
  if to_char(new.session_date, 'YYYY-MM') <> new.year_month then
    raise exception '対象年月(%)と希望日(%)の月が一致しません', new.year_month, new.session_date;
  end if;

  if not exists (
    select 1 from public.business_slots bs
     where bs.business_id = new.business_id
       and bs.weekday = extract(dow from new.session_date)::smallint
       and bs.slot_no = new.slot_no
       and bs.active
  ) then
    raise exception 'この事業では % の第%コマは開催されていません', new.session_date, new.slot_no;
  end if;

  return new;
end;
$$;

create trigger work_preferences_validate
  before insert or update on public.work_preferences
  for each row execute function public.validate_work_preference();

-- -----------------------------------------------------------------------------
-- 確定スケジュールの開催枠チェック
-- -----------------------------------------------------------------------------

create or replace function public.validate_schedule()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.business_slots bs
     where bs.business_id = new.business_id
       and bs.weekday = extract(dow from new.session_date)::smallint
       and bs.slot_no = new.slot_no
       and bs.active
  ) then
    raise exception 'この事業では % の第%コマは開催されていません', new.session_date, new.slot_no;
  end if;
  return new;
end;
$$;

create trigger schedules_validate
  before insert or update on public.schedules
  for each row execute function public.validate_schedule();

-- -----------------------------------------------------------------------------
-- 出席をマークしたら marked_at / marked_by を自動で埋める
-- -----------------------------------------------------------------------------

create or replace function public.stamp_attendance()
returns trigger
language plpgsql
as $$
begin
  if new.attendance_status is distinct from old.attendance_status then
    if new.attendance_status is null then
      new.marked_at := null;
      new.marked_by := null;
    else
      new.marked_at := now();
      new.marked_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger schedule_students_stamp_attendance
  before update on public.schedule_students
  for each row execute function public.stamp_attendance();

-- -----------------------------------------------------------------------------
-- 授業記録を書いたら noted_at / noted_by を自動で埋める
-- 出欠を「欠席」にしたら所見を落とす（欠席の回に所見は残さない。行自体は残る）
-- -----------------------------------------------------------------------------

create or replace function public.stamp_lesson_note()
returns trigger
language plpgsql
as $$
begin
  if new.attendance_status = 'absent' then
    new.note := null;
  end if;

  if new.note is distinct from old.note then
    if new.note is null then
      new.noted_at := null;
      new.noted_by := null;
    else
      new.noted_at := now();
      new.noted_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

-- stamp_attendance の後に動かす（欠席にした結果を受けて所見を落とすため）
create trigger schedule_students_stamp_note
  before update on public.schedule_students
  for each row execute function public.stamp_lesson_note();

-- =============================================================================
-- ビュー（すべて security_invoker。呼び出したユーザーの RLS が適用される）
-- =============================================================================

-- 生徒 + 計算した学年 + 現在のコース情報
create view public.students_with_grade
with (security_invoker = true)
as
select
  s.id,
  s.name,
  s.parent_id,
  s.business_id,
  s.course_id,
  s.enrollment_year,
  s.active,
  public.student_grade(s.enrollment_year, current_date) as grade,
  c.grade_label,
  c.grade_min,
  c.grade_max,
  c.sessions_per_month,
  c.monthly_fee
from public.students s
join public.courses c on c.id = s.course_id;

-- 1コマの定員と充足状況
--   定員 = 担当従業員数 × businesses.students_per_employee
create view public.schedule_capacity
with (security_invoker = true)
as
select
  sc.id           as schedule_id,
  sc.business_id,
  sc.session_date,
  sc.slot_no,
  sc.status,
  coalesce(e.employee_count, 0)                          as employee_count,
  coalesce(e.employee_count, 0) * b.students_per_employee as capacity,
  coalesce(st.student_count, 0)                          as student_count,
  coalesce(st.student_count, 0)
    > coalesce(e.employee_count, 0) * b.students_per_employee as is_over_capacity
from public.schedules sc
join public.businesses b on b.id = sc.business_id
left join (
  select schedule_id, count(*)::int as employee_count
    from public.schedule_employees group by schedule_id
) e on e.schedule_id = sc.id
left join (
  select schedule_id, count(*)::int as student_count
    from public.schedule_students group by schedule_id
) st on st.schedule_id = sc.id;

-- 進級処理（機能11）用。学年がコースの適用範囲から外れた生徒を検出する。
--   検出は自動、適用は管理者承認。このビューは提示するだけで何も更新しない。
--   中3を超えた生徒は該当コースが無いため suggested_course_id が null になる（扱いは保留中）。
create view public.students_needing_course_change
with (security_invoker = true)
as
select
  s.id                     as student_id,
  s.name,
  s.business_id,
  public.student_grade(s.enrollment_year, current_date) as grade,
  c.id                     as current_course_id,
  c.grade_label            as current_grade_label,
  c.sessions_per_month,
  c.monthly_fee            as current_fee,
  nc.id                    as suggested_course_id,
  nc.grade_label           as suggested_grade_label,
  nc.monthly_fee           as suggested_fee,
  nc.monthly_fee - c.monthly_fee as fee_diff
from public.students s
join public.courses c on c.id = s.course_id
left join lateral (
  select c2.id, c2.grade_label, c2.monthly_fee
    from public.courses c2
   where c2.business_id = s.business_id
     and c2.active
     and c2.sessions_per_month = c.sessions_per_month   -- 月回数は維持する
     and public.student_grade(s.enrollment_year, current_date)
         between c2.grade_min and c2.grade_max
   limit 1
) nc on true
where s.active
  and public.student_grade(s.enrollment_year, current_date)
      not between c.grade_min and c.grade_max;

comment on view public.students_needing_course_change is
  '進級でコース変更が必要な生徒。検出のみ。適用は管理者が承認して初めて行う（ドメインルール9）。';

-- -----------------------------------------------------------------------------
-- 給与（ドメインルール11: 締めるまで保存せず、確定したコマから毎回計算する）
--
-- 1コマの長さは business_slots から取る（90分をコードに埋め込まない）。
-- 時給・交通費は「その日に適用されていた行」を引くので、昇給しても過去分は動かない。
-- -----------------------------------------------------------------------------

-- 講師の勤務実績を1コマ1行で。確定したコマだけが勤務実績になる。
create view public.employee_work_slots
with (security_invoker = true)
as
select
  se.employee_id,
  sc.id                                as schedule_id,
  sc.business_id,
  sc.session_date,
  sc.slot_no,
  to_char(sc.session_date, 'YYYY-MM')  as year_month,
  (extract(epoch from (bs.end_time - bs.start_time)) / 3600.0)::numeric(4,2) as hours,
  coalesce(wr.hourly_rate, 0)          as hourly_rate,
  round((extract(epoch from (bs.end_time - bs.start_time)) / 3600.0)
        * coalesce(wr.hourly_rate, 0))::int as amount
from public.schedule_employees se
join public.schedules sc      on sc.id = se.schedule_id
join public.business_slots bs on bs.business_id = sc.business_id
                            and bs.slot_no     = sc.slot_no
                            and bs.weekday     = extract(dow from sc.session_date)::smallint
left join lateral (
  select w.hourly_rate
    from public.wage_rates w
   where w.employee_id    = se.employee_id
     and w.business_id    = sc.business_id
     and w.effective_from <= sc.session_date
   order by w.effective_from desc
   limit 1
) wr on true
where sc.status = 'confirmed';

comment on view public.employee_work_slots is
  '確定したコマ = 勤務実績。1コマの長さは business_slots から計算する（コードに埋めない）。';

-- 月ごとの支給額。締め前は計算値、確定後は payrolls の値が正。
create view public.employee_monthly_pay
with (security_invoker = true)
as
with slots as (
  select employee_id, year_month,
         count(*)::int                 as slots,
         sum(hours)::numeric(6,2)      as work_hours,
         sum(amount)::int              as base_amount
    from public.employee_work_slots
   group by employee_id, year_month
),
work_days as (
  -- 交通費は出勤「日」に対して1日ぶん（日曜の掛け持ちでも1日）
  select d.employee_id, d.year_month,
         count(*)::int                        as work_days,
         coalesce(sum(ca.daily_amount), 0)::int as commute
    from (select distinct employee_id, year_month, session_date
            from public.employee_work_slots) d
    left join lateral (
      select c.daily_amount
        from public.commute_allowances c
       where c.employee_id    = d.employee_id
         and c.effective_from <= d.session_date
       order by c.effective_from desc
       limit 1
    ) ca on true
   group by d.employee_id, d.year_month
),
overtime as (
  -- 承認した分だけ。割増は付かない（法定残業とは別物）
  select o.employee_id,
         to_char(o.work_date, 'YYYY-MM')                        as year_month,
         sum(round(o.hours * coalesce(wr.hourly_rate, 0)))::int as overtime
    from public.overtime_requests o
    left join lateral (
      select w.hourly_rate
        from public.wage_rates w
       where w.employee_id    = o.employee_id
         and w.business_id    = o.business_id
         and w.effective_from <= o.work_date
       order by w.effective_from desc
       limit 1
    ) wr on true
   where o.status = 'approved'
   group by o.employee_id, to_char(o.work_date, 'YYYY-MM')
),
keys as (
  select employee_id, year_month from slots
  union
  select employee_id, year_month from overtime
  union
  select employee_id, year_month from public.payrolls
)
select
  k.employee_id,
  k.year_month,
  coalesce(p.status, 'draft')::public.payroll_status as status,
  coalesce(p.work_days,   w.work_days,   0)                as work_days,
  coalesce(p.work_hours,  s.work_hours,  0)::numeric(6,2)  as work_hours,
  coalesce(p.base_amount, s.base_amount, 0)                as base_amount,
  coalesce(p.commute,     w.commute,     0)                as commute,
  coalesce(p.overtime,    o.overtime,    0)                as overtime,
  coalesce(p.total,
           coalesce(s.base_amount, 0) + coalesce(w.commute, 0) + coalesce(o.overtime, 0)) as total,
  coalesce(s.slots, 0) as slots,
  p.confirmed_at
from keys k
left join slots     s on s.employee_id = k.employee_id and s.year_month = k.year_month
left join work_days w on w.employee_id = k.employee_id and w.year_month = k.year_month
left join overtime  o on o.employee_id = k.employee_id and o.year_month = k.year_month
left join public.payrolls p
       on p.employee_id = k.employee_id and p.year_month = k.year_month
      and p.status = 'confirmed';

comment on view public.employee_monthly_pay is
  '締め前はコマからの計算値、確定後は payrolls の値。画面はこのビューだけを見れば金額が食い違わない。';

-- ビューは security_invoker なので行の絞り込みは元テーブルの RLS が行う。
-- ここでは参照権限だけ明示的に付与する。
grant select on public.students_with_grade             to authenticated;
grant select on public.schedule_capacity               to authenticated;
grant select on public.students_needing_course_change  to authenticated;
grant select on public.employee_work_slots             to authenticated;
grant select on public.employee_monthly_pay            to authenticated;
