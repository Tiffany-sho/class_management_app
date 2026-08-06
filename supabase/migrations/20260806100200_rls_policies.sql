-- =============================================================================
-- R-Tech 管理システム — Row Level Security
--
-- 方針（CLAUDE.md 開発メモ）:
--   保護者は自分の子のデータのみ / 従業員は自分の勤務と担当コマの生徒のみ
--   を DB レベルで担保する。アプリ側のフィルタだけに頼らない。
--
-- 注意: ポリシーの副問い合わせにも RLS が適用されるため、テーブル同士を
--       相互参照すると無限再帰になる。判定は security definer 関数に逃がす。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 判定ヘルパー（security definer = RLS をバイパスして再帰を断つ）
-- -----------------------------------------------------------------------------

create or replace function public.is_parent_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students
     where id = p_student_id and parent_id = auth.uid()
  );
$$;

create or replace function public.is_assigned_to_schedule(p_schedule_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.schedule_employees
     where schedule_id = p_schedule_id and employee_id = auth.uid()
  );
$$;

-- 自分が担当するコマに、その生徒が入っているか
create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.schedule_students ss
      join public.schedule_employees se on se.schedule_id = ss.schedule_id
     where ss.student_id = p_student_id
       and se.employee_id = auth.uid()
  );
$$;

-- お知らせの事業フィルタ用（null = 全事業向け）
create or replace function public.is_related_to_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_business_id is null
      or exists (select 1 from public.students
                  where parent_id = auth.uid() and business_id = p_business_id)
      or exists (select 1 from public.employee_businesses
                  where employee_id = auth.uid() and business_id = p_business_id);
$$;

-- -----------------------------------------------------------------------------
-- RLS 有効化
-- -----------------------------------------------------------------------------
alter table public.businesses          enable row level security;
alter table public.business_slots      enable row level security;
alter table public.courses             enable row level security;
alter table public.users               enable row level security;
alter table public.employee_businesses enable row level security;
alter table public.students            enable row level security;
alter table public.preferences         enable row level security;
alter table public.work_preferences    enable row level security;
alter table public.schedules           enable row level security;
alter table public.schedule_employees  enable row level security;
alter table public.schedule_students   enable row level security;
alter table public.absence_reports     enable row level security;
alter table public.fees                enable row level security;
alter table public.announcements       enable row level security;
alter table public.deadlines           enable row level security;
alter table public.deadline_rules      enable row level security;
alter table public.notifications       enable row level security;
alter table public.push_tokens         enable row level security;
alter table public.wage_rates          enable row level security;
alter table public.commute_allowances  enable row level security;
alter table public.overtime_requests   enable row level security;
alter table public.payrolls            enable row level security;

-- =============================================================================
-- マスタ — 全員が読める / 管理者だけが書ける
-- =============================================================================

create policy businesses_select on public.businesses
  for select to authenticated using (true);
create policy businesses_admin_write on public.businesses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy business_slots_select on public.business_slots
  for select to authenticated using (true);
create policy business_slots_admin_write on public.business_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy courses_select on public.courses
  for select to authenticated using (true);
create policy courses_admin_write on public.courses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy deadlines_select on public.deadlines
  for select to authenticated using (true);
create policy deadlines_admin_write on public.deadlines
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy deadline_rules_select on public.deadline_rules
  for select to authenticated using (true);
create policy deadline_rules_admin_write on public.deadline_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- ユーザー
--   自分 / 管理者 / 従業員（担当講師名の表示に必要）は読める。
--   保護者の行は本人と管理者しか読めない。
-- =============================================================================

create policy users_select on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin() or role = 'employee');

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy employee_businesses_select on public.employee_businesses
  for select to authenticated using (true);
create policy employee_businesses_admin_write on public.employee_businesses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 生徒 — 保護者は自分の子、従業員は担当コマの生徒のみ
-- =============================================================================

create policy students_select on public.students
  for select to authenticated
  using (
    public.is_admin()
    or parent_id = auth.uid()
    or public.teaches_student(id)
  );

create policy students_admin_write on public.students
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 受講希望 — 保護者は自分の子の分のみ。締め切り前だけ書ける。
--   締め切り行が無い年月は is_submission_open() が false を返すため提出できない。
-- =============================================================================

create policy preferences_select on public.preferences
  for select to authenticated
  using (public.is_admin() or public.is_parent_of(student_id));

create policy preferences_parent_insert on public.preferences
  for insert to authenticated
  with check (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
  );

create policy preferences_parent_update on public.preferences
  for update to authenticated
  using (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
  )
  with check (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
  );

create policy preferences_parent_delete on public.preferences
  for delete to authenticated
  using (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
  );

-- 管理者は締め切り後も編集できる（実運用で必ず例外が出るため）
create policy preferences_admin_write on public.preferences
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 勤務希望 — 従業員は自分の分のみ。締め切り前だけ書ける。
-- =============================================================================

create policy work_preferences_select on public.work_preferences
  for select to authenticated
  using (public.is_admin() or employee_id = auth.uid());

create policy work_preferences_own_insert on public.work_preferences
  for insert to authenticated
  with check (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
  );

create policy work_preferences_own_update on public.work_preferences
  for update to authenticated
  using (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
  )
  with check (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
  );

create policy work_preferences_own_delete on public.work_preferences
  for delete to authenticated
  using (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
  );

create policy work_preferences_admin_write on public.work_preferences
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 確定スケジュール — 下書きは管理者だけに見せる
-- =============================================================================

create policy schedules_select on public.schedules
  for select to authenticated
  using (public.is_admin() or status = 'confirmed');

create policy schedules_admin_write on public.schedules
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy schedule_employees_select on public.schedule_employees
  for select to authenticated
  using (
    public.is_admin()
    or employee_id = auth.uid()
    or exists (select 1 from public.schedules s
                where s.id = schedule_id and s.status = 'confirmed')
  );

create policy schedule_employees_admin_write on public.schedule_employees
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 受講生徒・出席
--   出席マークは「担当コマの従業員」と管理者だけ。割り当ての追加削除は管理者のみ。
-- =============================================================================

create policy schedule_students_select on public.schedule_students
  for select to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(student_id)
    or public.is_assigned_to_schedule(schedule_id)
  );

create policy schedule_students_employee_update on public.schedule_students
  for update to authenticated
  using (public.is_assigned_to_schedule(schedule_id))
  with check (public.is_assigned_to_schedule(schedule_id));

create policy schedule_students_admin_write on public.schedule_students
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 欠席連絡 — 保護者が出し、管理者と担当従業員が読む
-- =============================================================================

create policy absence_reports_select on public.absence_reports
  for select to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(student_id)
    or public.is_assigned_to_schedule(schedule_id)
  );

create policy absence_reports_parent_insert on public.absence_reports
  for insert to authenticated
  with check (public.is_parent_of(student_id) and created_by = auth.uid());

create policy absence_reports_admin_write on public.absence_reports
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 月謝 — 保護者は自分の子の分だけ読める。従業員は一切見られない。
-- =============================================================================

create policy fees_select on public.fees
  for select to authenticated
  using (public.is_admin() or public.is_parent_of(student_id));

create policy fees_admin_write on public.fees
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- お知らせ — 宛先（ロール・事業）に合致するものだけ読める
-- =============================================================================

-- 予約中（sent_at が null で scheduled_at が未来）のものは対象者から隠す
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_admin()
    or (
      (sent_at is not null or scheduled_at is null)
      and (target_role is null or target_role = public.auth_user_role()::text)
      and public.is_related_to_business(business_id)
    )
  );

create policy announcements_admin_write on public.announcements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 通知・プッシュトークン — 本人のみ
--   （メール／プッシュ送信は Edge Function が service_role で行うため RLS 外）
-- =============================================================================

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_admin_write on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- 給与 — 本人と管理者だけ（ドメインルール12: 講師どうしで金額が見えてはいけない）
--
-- 保護者には一切見せない。時給・交通費・時間外・支給額のすべてが対象。
-- =============================================================================

create policy wage_rates_select on public.wage_rates
  for select to authenticated
  using (public.is_admin() or employee_id = auth.uid());
create policy wage_rates_admin_write on public.wage_rates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy commute_allowances_select on public.commute_allowances
  for select to authenticated
  using (public.is_admin() or employee_id = auth.uid());
create policy commute_allowances_admin_write on public.commute_allowances
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy overtime_requests_select on public.overtime_requests
  for select to authenticated
  using (public.is_admin() or employee_id = auth.uid());

-- 申請は本人が出す。status は既定の pending のみ許す（自分で承認できてはいけない）
create policy overtime_requests_own_insert on public.overtime_requests
  for insert to authenticated
  with check (employee_id = auth.uid() and status = 'pending');

-- 承認待ちのうちは本人が取り下げ・修正できる。決裁後は触れない
create policy overtime_requests_own_update on public.overtime_requests
  for update to authenticated
  using (employee_id = auth.uid() and status = 'pending')
  with check (employee_id = auth.uid() and status = 'pending');

create policy overtime_requests_own_delete on public.overtime_requests
  for delete to authenticated
  using (employee_id = auth.uid() and status = 'pending');

create policy overtime_requests_admin_write on public.overtime_requests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy payrolls_select on public.payrolls
  for select to authenticated
  using (public.is_admin() or employee_id = auth.uid());
create policy payrolls_admin_write on public.payrolls
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 権限付与
--   Supabase は既定でも authenticated に付与するが、この移行だけで完結するよう
--   明示しておく。実際の行の絞り込みはすべて上記 RLS が行う。
--   anon には何も与えない（未ログインでアクセスできるデータは無い）。
-- =============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

