-- =============================================================================
-- 希望の提出は1回きり（提出したらその月はもう変えられない）
--
-- 締め切りまでは何度でも直せる作りだった。しかし**細かく直されると、管理者が
-- 生徒と講師を組んでいる最中に土台が動く。** 組み終えたコマの根拠が消えることも
-- あるので、締め切りを待たずに固める。
--
-- 「提出したかどうか」を preferences の行数で判定してはいけない。
-- **0件で提出できる**（「今月は通えない」も伝える内容 ―― ドメインルール2）ので、
-- 0件のとき「まだ出していない」と区別が付かない。**提出した事実を行で持つ。**
--
-- 保護者は生徒ごと、講師は本人ごと。1つのテーブルにまとめてあるのは、
-- 判定も RLS も「その年月の行があるか」だけで済み、2つに分けると同じものを
-- 2回書くことになるため。
-- =============================================================================

create table public.submissions (
  id           uuid        primary key default gen_random_uuid(),
  year_month   text        not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  student_id   uuid        references public.students(id) on delete cascade,
  employee_id  uuid        references public.users(id)    on delete cascade,
  submitted_at timestamptz not null default now(),
  -- 生徒ぶんか講師ぶんのどちらか一方。両方入った行・どちらも空の行を作らせない
  constraint submissions_one_subject check (num_nonnulls(student_id, employee_id) = 1),
  constraint submissions_student_unique  unique (student_id, year_month),
  constraint submissions_employee_unique unique (employee_id, year_month)
);

create index submissions_month_idx on public.submissions (year_month);

comment on table public.submissions is
  '希望を提出した事実。行があればその年月はもう編集できない。0件提出と未提出を区別するために必要。';

-- -----------------------------------------------------------------------------
-- 判定ヘルパー。submissions にも RLS が効くので security definer で読む
-- （ポリシーの中から素直に select すると相互参照になる）。
-- -----------------------------------------------------------------------------
create or replace function public.student_submitted(p_student_id uuid, p_year_month text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.submissions
     where student_id = p_student_id and year_month = p_year_month
  );
$$;

create or replace function public.employee_submitted(p_employee_id uuid, p_year_month text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.submissions
     where employee_id = p_employee_id and year_month = p_year_month
  );
$$;

-- -----------------------------------------------------------------------------
-- 既にある希望は「提出済み」として扱う。
-- 行があるということは実際に提出したということなので、そのままにすると
-- **今までに出した人だけが後からいくらでも直せる**状態が残る。
-- （0件で出した人は行が無いので分からない。そこは拾えないと割り切る）
-- -----------------------------------------------------------------------------
insert into public.submissions (year_month, student_id)
select distinct year_month, student_id from public.preferences
on conflict do nothing;

insert into public.submissions (year_month, employee_id)
select distinct year_month, employee_id from public.work_preferences
on conflict do nothing;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.submissions enable row level security;

create policy submissions_select on public.submissions
  for select to authenticated
  using (
    public.is_admin()
    or (student_id  is not null and public.is_parent_of(student_id))
    or (employee_id is not null and employee_id = auth.uid())
  );

-- 出せるのは締め切り前だけ。二重提出は一意制約が弾く
create policy submissions_own_insert on public.submissions
  for insert to authenticated
  with check (
    (student_id is not null
      and public.is_parent_of(student_id)
      and public.is_submission_open(year_month, 'parent'))
    or (employee_id is not null
      and employee_id = auth.uid()
      and public.is_submission_open(year_month, 'employee'))
  );

/* 取り消しは管理者だけ。**間違えて出した人を助ける口はここしかない**ので、
   消せる人を管理者に限ったうえで必ず残す（消すと、その月はまた提出できる）。 */
create policy submissions_admin_write on public.submissions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.submissions to authenticated;
grant delete, update on public.submissions to authenticated;   -- 実際に通るのは管理者だけ（上のポリシー）

-- =============================================================================
-- 提出済みの月は、本人が希望を足す・消す・直すことができない
--   管理者は今までどおり全部できる（実運用で必ず例外が出る）。
-- =============================================================================
drop policy preferences_parent_insert on public.preferences;
drop policy preferences_parent_update on public.preferences;
drop policy preferences_parent_delete on public.preferences;

create policy preferences_parent_insert on public.preferences
  for insert to authenticated
  with check (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
    and not public.student_submitted(student_id, year_month)
  );

create policy preferences_parent_update on public.preferences
  for update to authenticated
  using (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
    and not public.student_submitted(student_id, year_month)
  )
  with check (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
    and not public.student_submitted(student_id, year_month)
  );

create policy preferences_parent_delete on public.preferences
  for delete to authenticated
  using (
    public.is_parent_of(student_id)
    and public.is_submission_open(year_month, 'parent')
    and not public.student_submitted(student_id, year_month)
  );

drop policy work_preferences_own_insert on public.work_preferences;
drop policy work_preferences_own_update on public.work_preferences;
drop policy work_preferences_own_delete on public.work_preferences;

create policy work_preferences_own_insert on public.work_preferences
  for insert to authenticated
  with check (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
    and not public.employee_submitted(employee_id, year_month)
  );

create policy work_preferences_own_update on public.work_preferences
  for update to authenticated
  using (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
    and not public.employee_submitted(employee_id, year_month)
  )
  with check (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
    and not public.employee_submitted(employee_id, year_month)
  );

create policy work_preferences_own_delete on public.work_preferences
  for delete to authenticated
  using (
    employee_id = auth.uid()
    and public.is_submission_open(year_month, 'employee')
    and not public.employee_submitted(employee_id, year_month)
  );
