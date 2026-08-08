-- =============================================================================
-- D群: 関数（16項目） / E群: ビュー（15項目）
-- 全体を begin 〜 rollback で囲む。データは1行も残らない。
-- =============================================================================
begin;

create temp table t_result(no text, item text, verdict text, detail text);

create function pg_temp.eq(no text, item text, actual text, expected text) returns void
language plpgsql as $f$
begin
  insert into pg_temp.t_result values (no, item,
    case when actual is not distinct from expected then 'OK' else 'NG' end,
    case when actual is not distinct from expected then coalesce(actual, '(null)')
         else '★' || coalesce(actual, '(null)') || ' ≠ ' || coalesce(expected, '(null)') end);
end $f$;

create function pg_temp.ng(no text, item text, stmt text, want text) returns void
language plpgsql as $f$
begin
  execute stmt;
  insert into pg_temp.t_result values (no, item, 'NG', '★通ってしまった');
exception when others then
  insert into pg_temp.t_result values (no, item,
    case when sqlerrm like '%' || want || '%' then 'OK' else 'NG' end,
    case when sqlerrm like '%' || want || '%' then '弾いた: ' else '★別の理由: ' end
      || substr(sqlerrm, 1, 55));
end $f$;

-- ============================== D: 関数 ==============================
do $$
declare n int; n2 int; amt int; fee0 int; d date; ym text; s_id uuid; c_id uuid; a_id uuid;
begin
  ---------------------------------------------------------------- 年度・学年
  perform pg_temp.eq('D01a', '年度: 3月31日は前年度',
    public.academic_year('2026-03-31')::text, '2025');
  perform pg_temp.eq('D01b', '年度: 4月1日から当年度',
    public.academic_year('2026-04-01')::text, '2026');

  perform pg_temp.eq('D02a', '学年: 3月31日時点（2025年度入学 → 小1）',
    public.student_grade(2025::smallint, '2026-03-31')::text, '1');
  perform pg_temp.eq('D02b', '学年: 4月1日に1つ上がる',
    public.student_grade(2025::smallint, '2026-04-01')::text, '2');

  perform pg_temp.eq('D03', '学年: 中3（9）を超えても止めずに返す',
    (public.student_grade(2016::smallint, '2026-04-01') > 9)::text, 'true');

  ---------------------------------------------------------------- generate_fees
  select public.generate_fees('1999-06') into n;
  select count(*) into n2 from public.fees where year_month = '1999-06';
  perform pg_temp.eq('D04', '月謝発行: 在籍生徒ぶん作られ、件数が戻る',
    format('戻り値%s / 実際%s', n, n2),
    format('戻り値%s / 実際%s', (select count(*) from public.students where active), n2));

  select public.generate_fees('1999-06') into n;
  perform pg_temp.eq('D05', '月謝発行: 2回目は0件（増えない）', n::text, '0');

  perform pg_temp.ng('D06', '月謝発行: 年月の形が不正なら弾く',
    'select public.generate_fees(''2026-13'')', '');

  -- 発行後にコース料金を改定しても、発行済みの請求額は動かない
  select f.student_id, f.amount into s_id, fee0
    from public.fees f where f.year_month = '1999-06' limit 1;
  select course_id into c_id from public.students where id = s_id;
  update public.courses set monthly_fee = monthly_fee + 5000 where id = c_id;
  perform public.generate_fees('1999-06');
  select amount into amt from public.fees where student_id = s_id and year_month = '1999-06';
  perform pg_temp.eq('D07', '月謝発行: 料金を改定しても発行済みの請求額は動かない',
    amt::text, fee0::text);
  update public.courses set monthly_fee = monthly_fee - 5000 where id = c_id;

  ---------------------------------------------------------------- generate_deadlines
  delete from public.deadlines where year_month = '2027-03';
  perform public.generate_deadlines('2027-03');
  select count(*) into n from public.deadlines where year_month = '2027-03';
  perform pg_temp.eq('D08', '締切生成: ルールから作られる（保護者・講師の2件）', n::text, '2');

  -- 31日ルール × 2月 → 末日に丸まる
  delete from public.deadlines where year_month = '2027-03';
  update public.deadline_rules set day_of_month = 31;
  perform public.generate_deadlines('2027-03');
  select (deadline_at at time zone 'Asia/Tokyo')::date into d
    from public.deadlines where year_month = '2027-03' and type = 'parent';
  perform pg_temp.eq('D09', '締切生成: 31日指定でも2月は末日に丸まる', d::text, '2027-02-28');

  perform public.generate_deadlines('2027-03');
  select count(*) into n from public.deadlines where year_month = '2027-03';
  perform pg_temp.eq('D10', '締切生成: 2回実行しても増えない', n::text, '2');

  -- 生成済みはルールを変えても動かない
  update public.deadline_rules set day_of_month = 5;
  perform public.generate_deadlines('2027-03');
  select (deadline_at at time zone 'Asia/Tokyo')::date into d
    from public.deadlines where year_month = '2027-03' and type = 'parent';
  perform pg_temp.eq('D11', '締切生成: ルールを変えても生成済みの月は動かない',
    d::text, '2027-02-28');

  /* ★ D09 / D11 が落ちるのはタイムゾーンの取り違えが原因。
     generate_deadlines は「前月◯日 23:59（JST）」を作るつもりで
       (date_trunc(...) + time_of_day) at time zone 'Asia/Tokyo'
     と書いているが、左辺が timestamptz に解決されるため、
     **JST の壁時計を UTC に直す** のではなく **UTC の瞬間を JST の壁時計に読み替えて**しまう。
     結果、締切が意図より9時間うしろにずれる。 */
  delete from public.deadlines where year_month = '2027-09';
  update public.deadline_rules set day_of_month = 20, time_of_day = '23:59';
  perform public.generate_deadlines('2027-09');
  perform pg_temp.eq('D17', '★締切生成: ルール「20日 23:59」が日本時間でそのとおりになる',
    (select to_char(deadline_at at time zone 'Asia/Tokyo', 'MM-DD HH24:MI')
       from public.deadlines where year_month = '2027-09' and type = 'parent'),
    '08-20 23:59');

  ---------------------------------------------------------------- is_submission_open
  delete from public.deadlines where year_month = '2027-05';
  perform pg_temp.eq('D12a', '受付判定: 締切行が無い月は false',
    public.is_submission_open('2027-05', 'parent')::text, 'false');

  insert into public.deadlines(year_month, type, deadline_at, active)
  values ('2027-05', 'parent', now() + interval '1 day', true);
  perform pg_temp.eq('D12b', '受付判定: 締切前は true',
    public.is_submission_open('2027-05', 'parent')::text, 'true');

  update public.deadlines set deadline_at = now() - interval '1 day' where year_month = '2027-05';
  perform pg_temp.eq('D12c', '受付判定: 締切後は false',
    public.is_submission_open('2027-05', 'parent')::text, 'false');

  update public.deadlines set deadline_at = now() + interval '1 day', active = false
   where year_month = '2027-05';
  perform pg_temp.eq('D12d', '受付判定: active=false なら締切前でも false',
    public.is_submission_open('2027-05', 'parent')::text, 'false');

  ---------------------------------------------------------------- send_due_announcements
  select id into a_id from public.users where role = 'admin' order by created_at limit 1;
  insert into public.announcements(id, title, body, author_id, scheduled_at, sent_at)
  values ('eeeeeeee-0000-0000-0000-000000000001', '予約（過去）', 'x', a_id,
          now() - interval '1 hour', null),
         ('eeeeeeee-0000-0000-0000-000000000002', '予約（未来）', 'x', a_id,
          now() + interval '1 day', null);
  perform public.send_due_announcements();
  perform pg_temp.eq('D13', '予約投稿: 時刻を過ぎたものは送信済みになる',
    (select (sent_at is not null)::text from public.announcements
      where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'true');
  perform pg_temp.eq('D14', '予約投稿: まだ先のものは触らない',
    (select coalesce(sent_at::text, 'null') from public.announcements
      where id = 'eeeeeeee-0000-0000-0000-000000000002'), 'null');
end $$;

-- D15 / D16: handle_new_user
do $$
declare uid1 uuid := 'eeeeeeee-1111-0000-0000-000000000001';
        uid2 uuid := 'eeeeeeee-1111-0000-0000-000000000002';
begin
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password,
                         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                         created_at, updated_at, confirmation_token, recovery_token,
                         email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid1, 'authenticated', 'authenticated',
          'test-emp@example.com', 'x', now(), '{}'::jsonb,
          '{"name":"テスト講師","role":"employee"}'::jsonb, now(), now(), '', '', '', ''),
         ('00000000-0000-0000-0000-000000000000', uid2, 'authenticated', 'authenticated',
          'test-noname@example.com', 'x', now(), '{}'::jsonb,
          '{}'::jsonb, now(), now(), '', '', '', '');

  perform pg_temp.eq('D15', '新規ユーザー: metadata の role が public.users に反映される',
    (select role::text || '/' || name from public.users where id = uid1), 'employee/テスト講師');
  perform pg_temp.eq('D16', '新規ユーザー: metadata が無いと parent になる',
    (select role::text from public.users where id = uid2), 'parent');
end $$;

-- ============================== E: ビュー ==============================
do $$
declare n int; n2 int; b_prog uuid; sch uuid; e_id uuid; ym text; d date;
begin
  ---------------------------------------------------------------- students_with_grade
  perform pg_temp.eq('E01', '学年ビュー: 学年 = 年度 − 入学年度 + 1',
    (select count(*)::text from public.students_with_grade v join public.students s on s.id = v.id
      where v.grade <> public.academic_year(current_date) - s.enrollment_year + 1), '0');
  perform pg_temp.eq('E02', '学年ビュー: 生徒が1人も欠けない',
    (select count(*)::text from public.students_with_grade),
    (select count(*)::text from public.students));

  ---------------------------------------------------------------- schedule_capacity
  perform pg_temp.eq('E03', '定員 = 担当講師数 × 事業ごとの係数',
    (select count(*)::text from public.schedule_capacity c
       join public.schedules s on s.id = c.schedule_id
       join public.businesses b on b.id = s.business_id
      where c.capacity <> b.students_per_employee *
            (select count(*) from public.schedule_employees se where se.schedule_id = s.id)), '0');

  select id into b_prog from public.businesses where name = 'プログラミング教室';
  select s.id into sch from public.schedules s
    join public.schedule_students ss on ss.schedule_id = s.id
   group by s.id having count(*) > 0 limit 1;
  delete from public.schedule_employees where schedule_id = sch;
  perform pg_temp.eq('E04', '担当0人なら定員0・定員超過になる',
    (select capacity::text || '/' || is_over_capacity::text
       from public.schedule_capacity where schedule_id = sch), '0/true');

  select employee_id into e_id from public.employee_businesses eb
    join public.schedules s on s.business_id = eb.business_id where s.id = sch limit 1;
  insert into public.schedule_employees(schedule_id, employee_id, business_id)
  select sch, e_id, business_id from public.schedules where id = sch;
  perform pg_temp.eq('E05', '講師を1人足すと定員が伸びる',
    (select (capacity > 0)::text from public.schedule_capacity where schedule_id = sch), 'true');

  ---------------------------------------------------------------- employee_work_slots
  perform pg_temp.eq('E06', '勤務コマ: 確定済みのコマだけが出る',
    (select count(*)::text from public.employee_work_slots w
       join public.schedules s on s.id = w.schedule_id where s.status <> 'confirmed'), '0');

  perform pg_temp.eq('E08', '勤務コマ: 時給が未設定でも null にならない（0になる）',
    (select count(*)::text from public.employee_work_slots where hourly_rate is null), '0');

  perform pg_temp.eq('E09', '勤務コマ: 金額 = round(時間 × 時給)',
    (select count(*)::text from public.employee_work_slots
      where amount <> round(hours * hourly_rate)), '0');

  ---------------------------------------------------------------- employee_monthly_pay
  ym := to_char(current_date, 'YYYY-MM');
  perform pg_temp.eq('E11', '月給: 交通費 = 出勤「日」数 × 日額（コマ数ではない）',
    (select count(*)::text
       from public.employee_monthly_pay p
       join lateral (select count(distinct session_date) d
                       from public.employee_work_slots w
                      where w.employee_id = p.employee_id and w.year_month = p.year_month) x on true
       join lateral (select coalesce(max(daily_amount),0) a from public.commute_allowances c
                      where c.employee_id = p.employee_id and c.effective_from <= current_date) y on true
      where p.year_month = ym and p.status = 'draft' and p.commute <> x.d * y.a), '0');

  perform pg_temp.eq('E10a', '月給: 締め前は計算値（status=draft）',
    (select count(*)::text from public.employee_monthly_pay
      where year_month = ym and status = 'draft' and total > 0),
    (select count(*)::text from public.employee_monthly_pay
      where year_month = ym and total > 0));
end $$;

-- E07: 昇給しても、昇給前のコマは昇給前の時給で出る
do $$
declare e_id uuid; b_id uuid; d date; sch uuid; rate int;
begin
  select w.employee_id, w.business_id into e_id, b_id
    from public.wage_rates w group by w.employee_id, w.business_id having count(*) > 1 limit 1;
  if e_id is null then
    perform pg_temp.eq('E07', '勤務コマ: 昇給前のコマは旧時給（履歴を持つ講師がいない）', 'skip', 'skip');
  else
    -- 古い時給の期間にある日曜を1つ作って確定させる
    select min(effective_from) into d from public.wage_rates where employee_id = e_id and business_id = b_id;
    select min(x)::date into d from generate_series(d, d + 30, interval '1 day') x
      where extract(dow from x) = 0;
    select hourly_rate into rate from public.wage_rates
     where employee_id = e_id and business_id = b_id and effective_from <= d
     order by effective_from desc limit 1;
    insert into public.schedules(business_id, session_date, slot_no, status)
    values (b_id, d, 1, 'confirmed') returning id into sch;
    insert into public.schedule_employees(schedule_id, employee_id, business_id)
    values (sch, e_id, b_id);
    perform pg_temp.eq('E07', format('勤務コマ: 昇給前(%s)のコマは旧時給 %s で出る', d, rate),
      (select hourly_rate::text from public.employee_work_slots where schedule_id = sch), rate::text);
  end if;
end $$;

-- E12 / E13: 時間外は承認済みだけ、割増なし
do $$
declare e_id uuid; b_id uuid; a_id uuid; ym text; base int; after1 int; after2 int; rate int;
begin
  ym := to_char(current_date, 'YYYY-MM');
  select eb.employee_id, eb.business_id into e_id, b_id from public.employee_businesses eb limit 1;
  select id into a_id from public.users where role = 'admin' order by created_at limit 1;
  delete from public.overtime_requests where employee_id = e_id
     and to_char(work_date, 'YYYY-MM') = ym;
  select coalesce(overtime, 0) into base from public.employee_monthly_pay
   where employee_id = e_id and year_month = ym;

  insert into public.overtime_requests(employee_id, business_id, work_date, description, hours, status)
  values (e_id, b_id, date_trunc('month', current_date)::date, 'テスト', 2, 'pending');
  select coalesce(overtime, 0) into after1 from public.employee_monthly_pay
   where employee_id = e_id and year_month = ym;
  perform pg_temp.eq('E12a', '月給: 承認待ちの時間外は加算されない', after1::text, coalesce(base,0)::text);

  update public.overtime_requests set status = 'rejected', decided_by = a_id, decided_at = now()
   where employee_id = e_id and description = 'テスト';
  select coalesce(overtime, 0) into after1 from public.employee_monthly_pay
   where employee_id = e_id and year_month = ym;
  perform pg_temp.eq('E12b', '月給: 却下された時間外は加算されない', after1::text, coalesce(base,0)::text);

  update public.overtime_requests set status = 'approved'
   where employee_id = e_id and description = 'テスト';
  select coalesce(overtime, 0) into after2 from public.employee_monthly_pay
   where employee_id = e_id and year_month = ym;
  select hourly_rate into rate from public.wage_rates
   where employee_id = e_id and business_id = b_id
     and effective_from <= date_trunc('month', current_date)::date
   order by effective_from desc limit 1;
  perform pg_temp.eq('E12c', '月給: 承認済みの時間外だけ加算される',
    (after2 - coalesce(base,0))::text, (2 * rate)::text);
  perform pg_temp.eq('E13', format('月給: 時間外に割増が付かない（2時間 × %s円）', rate),
    (after2 - coalesce(base,0))::text, (2 * rate)::text);
end $$;

-- E14 / E15: 進級対象
do $$
begin
  perform pg_temp.eq('E14', '進級対象: 学年が区分から外れた生徒だけが出る',
    (select count(*)::text from public.students_needing_course_change v
       join public.students_with_grade g on g.id = v.student_id
       join public.courses c on c.id = g.course_id
      where g.grade between c.grade_min and c.grade_max), '0');

  perform pg_temp.eq('E15', '進級対象: 該当コースが無い生徒は suggested が null',
    (select count(*)::text from public.students_needing_course_change v
      where v.suggested_course_id is null and v.grade <= 9), '0');
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
