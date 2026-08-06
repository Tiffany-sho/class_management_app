-- =============================================================================
-- R-Tech 管理システム — スキーマ本体
--
-- 設計方針は CLAUDE.md を参照。特に以下を DB レベルで担保する。
--   * 運用値（開催曜日・コマ時間・コース・料金・定員係数）はすべてマスタテーブル
--   * 学年は保存せず enrollment_year から計算する
--   * 生徒は1事業のみ。事業をまたぐ割り当ては複合外部キーで禁止する
--   * 配列カラムを使わない
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 列挙型
-- -----------------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'parent', 'employee');
create type public.schedule_status   as enum ('draft', 'confirmed');
create type public.attendance_status as enum ('present', 'absent', 'late');
create type public.deadline_type     as enum ('parent', 'employee');
create type public.fee_status        as enum ('unpaid', 'paid');

-- -----------------------------------------------------------------------------
-- 共通トリガー関数
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- マスタ（管理者が編集する。Supabase ダッシュボードから直接編集できる想定）
-- =============================================================================

-- 事業（プログラミング教室 / イラスト教室）
create table public.businesses (
  id                    uuid primary key default gen_random_uuid(),
  name                  text        not null unique,
  -- DESIGN.md の signature カラートークン名。カレンダー・チップ・凡例で使う
  color_key             text        not null
                          check (color_key in ('forest','coral','peach','mint','yellow','mustard','cream')),
  -- 定員係数: 1コマの定員 = 担当従業員数 × この値
  students_per_employee smallint    not null default 3 check (students_per_employee > 0),
  sort_order            smallint    not null default 0,
  active                boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

comment on column public.businesses.students_per_employee is
  '1コマの定員 = 担当従業員数 × この値。既定 3。事業ごとに変更可。';

-- 開催曜日とコマ時間
create table public.business_slots (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  weekday     smallint    not null check (weekday between 0 and 6),  -- 0=日 .. 6=土
  slot_no     smallint    not null check (slot_no > 0),
  start_time  time        not null,
  end_time    time        not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint business_slots_unique     unique (business_id, weekday, slot_no),
  constraint business_slots_time_order check (end_time > start_time)
);

create trigger business_slots_set_updated_at
  before update on public.business_slots
  for each row execute function public.set_updated_at();

comment on column public.business_slots.weekday is '0=日曜 〜 6=土曜';

-- コース（料金表）: 事業 × 学年区分 × 月回数
create table public.courses (
  id                 uuid        primary key default gen_random_uuid(),
  business_id        uuid        not null references public.businesses(id) on delete cascade,
  grade_label        text        not null,                                     -- 例: '1・2学年'
  grade_min          smallint    not null check (grade_min between 1 and 9),   -- 小1=1 .. 中3=9
  grade_max          smallint    not null check (grade_max between 1 and 9),
  sessions_per_month smallint    not null check (sessions_per_month > 0),
  monthly_fee        integer     not null check (monthly_fee >= 0),
  is_default         boolean     not null default false,
  sort_order         smallint    not null default 0,
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint courses_grade_range check (grade_max >= grade_min),
  constraint courses_unique      unique (business_id, grade_label, sessions_per_month),
  -- students からの複合外部キー参照先（生徒と他事業のコースの組み合わせを防ぐ）
  constraint courses_id_business_key unique (id, business_id)
);

-- 学年区分ごとに標準コースはちょうど1つ
create unique index courses_one_default_per_grade
  on public.courses (business_id, grade_label)
  where is_default;

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

comment on column public.courses.grade_min is '小1=1 〜 小6=6、中1=7 〜 中3=9。生徒の学年から該当コースを判定する。';

-- =============================================================================
-- ユーザー・生徒
-- =============================================================================

-- auth.users と 1:1。アカウント発行は管理者の招待のみ（自己サインアップなし）
create table public.users (
  id         uuid        primary key references auth.users(id) on delete cascade,
  name       text        not null,
  email      text        not null unique,
  role       public.user_role not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- 招待で auth.users が作られたとき、public.users を自動生成する。
-- 招待時の metadata に name / role を入れておくこと。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'parent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 従業員が担当できる事業（「両方」があり得るので多対多）
create table public.employee_businesses (
  employee_id uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (employee_id, business_id)
);

-- 生徒。アカウントは持たない（操作は保護者経由）
create table public.students (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  parent_id       uuid        not null references public.users(id) on delete restrict,
  business_id     uuid        not null references public.businesses(id) on delete restrict,
  course_id       uuid        not null,
  -- 小学1年生になった年度。学年はここから計算する（学年カラムは持たない）
  enrollment_year smallint    not null check (enrollment_year between 2000 and 2100),
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- コースは必ず在籍事業のもの
  constraint students_course_business_fk
    foreign key (course_id, business_id)
    references public.courses (id, business_id) on update cascade,
  -- schedule_students からの複合外部キー参照先
  constraint students_id_business_key unique (id, business_id)
);

create index students_parent_idx   on public.students (parent_id);
create index students_business_idx on public.students (business_id);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

comment on column public.students.enrollment_year is
  '小学1年生になった年度。学年 = 年度 − enrollment_year + 1（年度は4月始まり）。学年は保存しない。';

-- =============================================================================
-- 希望提出
-- =============================================================================

-- 受講希望（保護者が生徒ごとに提出）
create table public.preferences (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students(id) on delete cascade,
  year_month   text        not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  session_date date        not null,
  slot_no      smallint    not null check (slot_no > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint preferences_unique unique (student_id, session_date, slot_no)
);

create index preferences_month_idx on public.preferences (year_month);

create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- 勤務希望（従業員が事業ごとに提出。日曜は2事業が並ぶので business_id が要る）
create table public.work_preferences (
  id           uuid        primary key default gen_random_uuid(),
  employee_id  uuid        not null references public.users(id) on delete cascade,
  business_id  uuid        not null references public.businesses(id) on delete cascade,
  year_month   text        not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  session_date date        not null,
  slot_no      smallint    not null check (slot_no > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint work_preferences_unique unique (employee_id, business_id, session_date, slot_no),
  -- 担当できない事業には希望を出せない
  constraint work_preferences_employee_business_fk
    foreign key (employee_id, business_id)
    references public.employee_businesses (employee_id, business_id) on delete cascade
);

create index work_preferences_month_idx on public.work_preferences (year_month);

create trigger work_preferences_set_updated_at
  before update on public.work_preferences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 確定スケジュール
-- =============================================================================

-- 事業 × 日付 × コマ で一意（日曜は2事業が同じ枠で並行開催されるため business_id が必須）
create table public.schedules (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references public.businesses(id) on delete restrict,
  session_date date        not null,
  slot_no      smallint    not null check (slot_no > 0),
  status       public.schedule_status not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint schedules_unique unique (business_id, session_date, slot_no),
  constraint schedules_id_business_key unique (id, business_id)
);

create index schedules_date_idx on public.schedules (session_date);

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- 担当従業員。定員はこの件数 × businesses.students_per_employee で決まる
create table public.schedule_employees (
  schedule_id uuid not null,
  employee_id uuid not null,
  business_id uuid not null,
  created_at  timestamptz not null default now(),
  primary key (schedule_id, employee_id),
  constraint schedule_employees_schedule_fk
    foreign key (schedule_id, business_id)
    references public.schedules (id, business_id) on delete cascade,
  -- 担当できない事業には割り当てられない
  constraint schedule_employees_employee_fk
    foreign key (employee_id, business_id)
    references public.employee_businesses (employee_id, business_id) on delete restrict
);

create index schedule_employees_employee_idx on public.schedule_employees (employee_id);

-- 受講生徒 + 出席状態（attendance テーブルは作らない。1コマ1生徒で1行）
create table public.schedule_students (
  schedule_id       uuid not null,
  student_id        uuid not null,
  business_id       uuid not null,
  attendance_status public.attendance_status,          -- null = 未マーク
  marked_at         timestamptz,
  marked_by         uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (schedule_id, student_id),
  constraint schedule_students_schedule_fk
    foreign key (schedule_id, business_id)
    references public.schedules (id, business_id) on delete cascade,
  -- 他事業の生徒を割り当てられない
  constraint schedule_students_student_fk
    foreign key (student_id, business_id)
    references public.students (id, business_id) on update cascade on delete restrict
);

create index schedule_students_student_idx on public.schedule_students (student_id);

create trigger schedule_students_set_updated_at
  before update on public.schedule_students
  for each row execute function public.set_updated_at();

-- 欠席連絡
create table public.absence_reports (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references public.students(id) on delete cascade,
  schedule_id uuid        not null references public.schedules(id) on delete cascade,
  reason      text,
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint absence_reports_unique unique (student_id, schedule_id)
);

-- =============================================================================
-- 月謝・連絡
-- =============================================================================

-- 月謝は固定月額。amount は生成時にコースの月額をコピーし、以後は独立した値として扱う。
-- （courses を join する作りにすると、料金改定で過去の請求額まで書き変わってしまう）
create table public.fees (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students(id) on delete restrict,
  year_month text        not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount     integer     not null check (amount >= 0),
  status     public.fee_status not null default 'unpaid',
  paid_date  date,
  note       text,                                     -- 手入力で調整したときの理由
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fees_unique unique (student_id, year_month)
);

create index fees_month_idx on public.fees (year_month);

create trigger fees_set_updated_at
  before update on public.fees
  for each row execute function public.set_updated_at();

comment on column public.fees.amount is
  '生成時に courses.monthly_fee をコピー。管理者が上書き可。過去分が料金改定で変わらないよう join しない。';

-- お知らせ
create table public.announcements (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  body        text        not null,
  author_id   uuid        not null references public.users(id) on delete restrict,
  target_role text        check (target_role in ('parent','employee')),  -- null = 全ロール
  business_id uuid        references public.businesses(id) on delete cascade, -- null = 全事業
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- 希望提出の締め切り。事業共通（business_id は持たない）。
-- 行が無い年月は「まだ受付を開いていない」扱いになる（RLS で提出を弾く）。
create table public.deadlines (
  id          uuid        primary key default gen_random_uuid(),
  year_month  text        not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  type        public.deadline_type not null,
  deadline_at timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint deadlines_unique unique (year_month, type)
);

create trigger deadlines_set_updated_at
  before update on public.deadlines
  for each row execute function public.set_updated_at();

-- アプリ内通知。メール・プッシュはこの行を作った副作用として送る
create table public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  type       text        not null,
  title      text        not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create table public.push_tokens (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.users(id) on delete cascade,
  expo_push_token text        not null unique,
  platform        text        not null check (platform in ('ios','android')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();
