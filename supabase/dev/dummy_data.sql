-- =============================================================================
-- 動作確認用のダミーデータ
--
-- ★ マイグレーションではない。migrations/ に置くと db push で本番に流れてしまう。
--   使うときは Supabase の SQL Editor にこのファイルを貼って実行する。
--
-- 消すときは同じフォルダの dummy_data_cleanup.sql を実行する。
-- ここで作る行の id はすべて 'dddddddd-' で始めてあり、cleanup はそれだけを消す。
-- **本物のデータを1件でも入れた後でも、cleanup は本物に触らない。**
--
-- ダミーの講師・保護者は auth.users から作る（handle_new_user トリガーを通して
-- public.users を生成させる）。招待の経路と同じにしておかないと、
-- 本番で招待したときだけ壊れる、という事故になる。
--
-- ★★ パスワードは 'rtech-demo-2026'（全アカウント共通）。動作確認のために設定している。
--   **このリポジトリは公開されているので、誰でもこのアカウントで入れる。**
--   本物の生徒・保護者のデータを入れる前に、必ず dummy_data_cleanup.sql を実行して
--   このアカウント群を消すこと。ログイン画面の「動作確認用アカウント」も一緒に消す。
--   メールは example.com（受信できない予約ドメイン）なので、パスワード再設定はできない。
--
-- 何度実行しても増えない（id 固定 + on conflict do nothing）。
-- =============================================================================

do $$
declare
  v_prog        uuid;
  v_illu        uuid;
  v_admin       uuid;
  -- 講師は事業を兼任しない。プログラミング2名 / イラスト5名
  v_emp_nakamura  uuid := 'dddddddd-0000-0000-0000-000000000101';  -- プログラミング
  v_emp_takahashi uuid := 'dddddddd-0000-0000-0000-000000000103';  -- プログラミング
  v_emp_kobayashi uuid := 'dddddddd-0000-0000-0000-000000000102';  -- イラスト
  v_emp_watanabe  uuid := 'dddddddd-0000-0000-0000-000000000104';  -- イラスト
  v_emp_ito       uuid := 'dddddddd-0000-0000-0000-000000000105';  -- イラスト
  v_emp_yamamoto  uuid := 'dddddddd-0000-0000-0000-000000000106';  -- イラスト
  v_emp_kato      uuid := 'dddddddd-0000-0000-0000-000000000107';  -- イラスト
  /* 保護者。**きょうだいは必ず同じ事業に通う**ので、保護者も事業ごとに分かれる。
     1人の保護者の子がプログラミングとイラストに分かれることはない。 */
  v_par_tanaka    uuid := 'dddddddd-0000-0000-0000-000000000201';  -- プログラミング
  v_par_sato      uuid := 'dddddddd-0000-0000-0000-000000000202';  -- プログラミング
  v_par_suzuki    uuid := 'dddddddd-0000-0000-0000-000000000203';  -- プログラミング
  v_par_yamada    uuid := 'dddddddd-0000-0000-0000-000000000204';  -- プログラミング
  v_par_nakagawa  uuid := 'dddddddd-0000-0000-0000-000000000205';  -- プログラミング
  v_par_ishii     uuid := 'dddddddd-0000-0000-0000-000000000206';  -- プログラミング
  v_par_mori      uuid := 'dddddddd-0000-0000-0000-000000000207';  -- イラスト
  v_par_ikeda     uuid := 'dddddddd-0000-0000-0000-000000000208';  -- イラスト
  v_par_onishi    uuid := 'dddddddd-0000-0000-0000-000000000209';  -- イラスト
  v_par_hirano    uuid := 'dddddddd-0000-0000-0000-000000000210';  -- イラスト
  v_par_uchida    uuid := 'dddddddd-0000-0000-0000-000000000211';  -- イラスト
  v_par_miura     uuid := 'dddddddd-0000-0000-0000-000000000212';  -- イラスト
  v_par_matsumoto uuid := 'dddddddd-0000-0000-0000-000000000213';  -- イラスト
  v_par_kinoshita uuid := 'dddddddd-0000-0000-0000-000000000214';  -- イラスト
  v_par_kawamura  uuid := 'dddddddd-0000-0000-0000-000000000215';  -- イラスト
  v_this_month  text := to_char(current_date, 'YYYY-MM');
  v_next_month  text := to_char(current_date + interval '1 month', 'YYYY-MM');
  v_day         date;
  v_sched       uuid;
  v_n           integer := 0;
  r             record;
  v_note        text;
begin
  select id into v_prog from public.businesses where name = 'プログラミング教室';
  select id into v_illu from public.businesses where name = 'イラスト教室';
  select id into v_admin from public.users where role = 'admin' order by created_at limit 1;

  if v_prog is null or v_illu is null then
    raise exception 'マスタデータが入っていません。先に 20260806100300_seed_master_data.sql を流してください。';
  end if;

  /* ---------------------------------------------------------------- 作り直し
     先に既存のダミーを消す。id だけを on conflict で見ていると、講師の人数や
     番号を振り直したときに「旧番号の行が別人として残る」ことが起きる
     （一意制約は employee_id + 日付なので、id が違っても衝突する）。
     **id ではなく関係でたどって消す。** 月謝は generate_fees が作るので id が
     'dddddddd-' で始まらず、id で消すと取り残されて外部キーに引っかかる。
     消す順番も大事で、schedule_employees を先に消さないと、
     employee_businesses を on delete restrict で掴んだままになる。
     auth.users は残す（id を固定したいため。パスワードは下で当て直す）。 */
  delete from public.schedule_students   where student_id::text  like 'dddddddd-%';
  delete from public.schedule_employees  where employee_id::text like 'dddddddd-%';
  delete from public.absence_reports     where student_id::text  like 'dddddddd-%';
  delete from public.schedules           where id::text          like 'dddddddd-%';
  delete from public.preferences         where student_id::text  like 'dddddddd-%';
  delete from public.work_preferences    where employee_id::text like 'dddddddd-%';
  delete from public.fees                where student_id::text  like 'dddddddd-%';
  delete from public.overtime_requests   where employee_id::text like 'dddddddd-%';
  delete from public.announcements       where id::text          like 'dddddddd-%';
  delete from public.notifications       where user_id::text     like 'dddddddd-%';
  delete from public.students            where id::text          like 'dddddddd-%';
  delete from public.wage_rates          where employee_id::text like 'dddddddd-%';
  delete from public.commute_allowances  where employee_id::text like 'dddddddd-%';
  delete from public.employee_businesses where employee_id::text like 'dddddddd-%';

  -- ---------------------------------------------------------------- 講師・保護者
  -- raw_user_meta_data の name / role を handle_new_user が読んで public.users を作る
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated',
    v.email,
    extensions.crypt('rtech-demo-2026', extensions.gen_salt('bf')),
    now(),                      -- 確認済みにしておく（未確認だとログインできない）
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v.name, 'role', v.role),
    now(), now(), '', '', '', ''
  from (values
    (v_emp_nakamura,  'nakamura@example.com',  '中村 さとし',   'employee'),
    (v_emp_takahashi, 'takahashi@example.com', '高橋 けんた',   'employee'),
    (v_emp_kobayashi, 'kobayashi@example.com', '小林 あやか',   'employee'),
    (v_emp_watanabe,  'watanabe@example.com',  '渡辺 みほ',     'employee'),
    (v_emp_ito,       'ito@example.com',       '伊藤 ゆうき',   'employee'),
    (v_emp_yamamoto,  'yamamoto@example.com',  '山本 えみ',     'employee'),
    (v_emp_kato,      'kato@example.com',      '加藤 りょう',   'employee'),
    (v_par_tanaka,    'tanaka@example.com',    '田中 さくら',   'parent'),
    (v_par_sato,      'sato@example.com',      '佐藤 ひろみ',   'parent'),
    (v_par_suzuki,    'suzuki@example.com',    '鈴木 なおき',   'parent'),
    (v_par_yamada,    'yamada@example.com',    '山田 かおり',   'parent'),
    (v_par_nakagawa,  'nakagawa@example.com',  '中川 たかし',   'parent'),
    (v_par_ishii,     'ishii@example.com',     '石井 まなみ',   'parent'),
    (v_par_mori,      'mori@example.com',      '森 ちひろ',     'parent'),
    (v_par_ikeda,     'ikeda@example.com',     '池田 ゆうこ',   'parent'),
    (v_par_onishi,    'onishi@example.com',    '大西 けいすけ', 'parent'),
    (v_par_hirano,    'hirano@example.com',    '平野 あき',     'parent'),
    (v_par_uchida,    'uchida@example.com',    '内田 まゆみ',   'parent'),
    (v_par_miura,     'miura@example.com',     '三浦 しんじ',   'parent'),
    (v_par_matsumoto, 'matsumoto@example.com', '松本 なつき',   'parent'),
    (v_par_kinoshita, 'kinoshita@example.com', '木下 ひかる',   'parent'),
    (v_par_kawamura,  'kawamura@example.com',  '川村 さおり',   'parent')
  ) as v(id, email, name, role)
  on conflict (id) do nothing;

  /* 既に作られている行にもパスワードを当てる（上の insert は on conflict で素通りする）。
     メール未確認だとログインできないので、そこも埋める。 */
  update auth.users
     set encrypted_password = extensions.crypt('rtech-demo-2026', extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now())
   where id::text like 'dddddddd-%';

  /* パスワードでのログインには auth.identities の行が要る。
     これが無いと、パスワードが合っていても「Invalid login credentials」になる。 */
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  select u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email,
                            'email_verified', true, 'phone_verified', false),
         'email', now(), now()
    from auth.users u
   where u.id::text like 'dddddddd-%'
     and not exists (select 1 from auth.identities i
                      where i.user_id = u.id and i.provider = 'email');

  -- 担当できる事業。兼任は作らない（1人1事業）
  insert into public.employee_businesses (employee_id, business_id)
  values
    (v_emp_nakamura,  v_prog), (v_emp_takahashi, v_prog),
    (v_emp_kobayashi, v_illu), (v_emp_watanabe,  v_illu), (v_emp_ito, v_illu),
    (v_emp_yamamoto,  v_illu), (v_emp_kato,      v_illu)
  on conflict do nothing;

  -- 時給。中村だけ昇給履歴を持たせる（古い行が出ないことの確認用）
  insert into public.wage_rates (id, employee_id, business_id, job_label, hourly_rate, effective_from)
  values
    ('dddddddd-0000-0000-0000-000000000301', v_emp_nakamura,  v_prog, 'プログラミング講師', 1600, (date_trunc('year', current_date) - interval '1 year')::date),
    ('dddddddd-0000-0000-0000-000000000302', v_emp_nakamura,  v_prog, 'プログラミング講師', 1800, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000303', v_emp_takahashi, v_prog, 'プログラミング講師', 1700, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000304', v_emp_kobayashi, v_illu, 'イラスト講師',       1500, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000305', v_emp_watanabe,  v_illu, 'イラスト講師',       1550, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000306', v_emp_ito,       v_illu, 'イラスト講師',       1450, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000307', v_emp_yamamoto,  v_illu, 'イラスト講師',       1500, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000308', v_emp_kato,      v_illu, 'イラスト講師',       1400, date_trunc('year', current_date)::date)
  on conflict (id) do nothing;

  insert into public.commute_allowances (id, employee_id, daily_amount, effective_from)
  values
    ('dddddddd-0000-0000-0000-000000000311', v_emp_nakamura,  600, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000312', v_emp_takahashi, 500, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000313', v_emp_kobayashi, 400, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000314', v_emp_watanabe,  450, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000315', v_emp_ito,       350, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000316', v_emp_yamamoto,  500, date_trunc('year', current_date)::date),
    ('dddddddd-0000-0000-0000-000000000317', v_emp_kato,      300, date_trunc('year', current_date)::date)
  on conflict (id) do nothing;

  /* ---------------------------------------------------------------- 生徒
     プログラミング10名 / イラスト15名。
     **きょうだいは必ず同じ事業。** 同じ保護者の子がプログラミングとイラストに
     分かれることはないので、保護者ごと事業が決まる。
     grade は「今の学年」。enrollment_year（小1になった年度）はここから逆算する
     （学年カラムは持たない ― docs/domain.md）。小1=1 .. 小6=6、中1=7 .. 中3=9。
     結衣・大和・芽依はわざとコースの学年区分から外し、進級処理に出るようにしてある
     （大和は中3を超えていて該当コースが無い = suggested が null になる側の確認用）。 */
  insert into public.students (id, name, parent_id, business_id, course_id, enrollment_year)
  select v.id, v.name, v.parent_id, v.business_id, c.id,
         (public.academic_year(current_date) - v.grade + 1)::smallint
  from (values
    -- プログラミング教室（10名）
    ('dddddddd-0000-0000-0000-000000000401'::uuid, '田中 陽翔',   v_par_tanaka,    v_prog, '1・2学年',         2,  2),
    ('dddddddd-0000-0000-0000-000000000402'::uuid, '田中 咲希',   v_par_tanaka,    v_prog, '3・4学年',         2,  4),
    ('dddddddd-0000-0000-0000-000000000403'::uuid, '佐藤 結衣',   v_par_sato,      v_prog, '3・4学年',         2,  5),  -- 進級対象
    ('dddddddd-0000-0000-0000-000000000404'::uuid, '鈴木 大和',   v_par_suzuki,    v_prog, '5・6学年・中学生', 3, 10),  -- 進級対象（該当コース無し）
    ('dddddddd-0000-0000-0000-000000000405'::uuid, '鈴木 ひなた', v_par_suzuki,    v_prog, '1・2学年',         2,  1),
    ('dddddddd-0000-0000-0000-000000000406'::uuid, '山田 蓮',     v_par_yamada,    v_prog, '3・4学年',         3,  3),
    ('dddddddd-0000-0000-0000-000000000407'::uuid, '山田 葵',     v_par_yamada,    v_prog, '5・6学年・中学生', 3,  6),
    ('dddddddd-0000-0000-0000-000000000408'::uuid, '中川 悠真',   v_par_nakagawa,  v_prog, '5・6学年・中学生', 2,  7),
    ('dddddddd-0000-0000-0000-000000000409'::uuid, '石井 陽菜',   v_par_ishii,     v_prog, '1・2学年',         3,  2),
    ('dddddddd-0000-0000-0000-000000000410'::uuid, '石井 律',     v_par_ishii,     v_prog, '3・4学年',         2,  4),
    -- イラスト教室（15名）
    ('dddddddd-0000-0000-0000-000000000411'::uuid, '森 芽依',     v_par_mori,      v_illu, '1・2学年',         2,  3),  -- 進級対象
    ('dddddddd-0000-0000-0000-000000000412'::uuid, '森 湊',       v_par_mori,      v_illu, '1・2学年',         2,  1),
    ('dddddddd-0000-0000-0000-000000000413'::uuid, '池田 心春',   v_par_ikeda,     v_illu, '3・4学年',         2,  4),
    ('dddddddd-0000-0000-0000-000000000414'::uuid, '池田 樹',     v_par_ikeda,     v_illu, '5・6学年・中学生', 3,  6),
    ('dddddddd-0000-0000-0000-000000000415'::uuid, '大西 凛',     v_par_onishi,    v_illu, '1・2学年',         3,  2),
    ('dddddddd-0000-0000-0000-000000000416'::uuid, '大西 蒼',     v_par_onishi,    v_illu, '5・6学年・中学生', 2,  5),
    ('dddddddd-0000-0000-0000-000000000417'::uuid, '平野 結菜',   v_par_hirano,    v_illu, '3・4学年',         2,  3),
    ('dddddddd-0000-0000-0000-000000000418'::uuid, '内田 楓',     v_par_uchida,    v_illu, '1・2学年',         2,  1),
    ('dddddddd-0000-0000-0000-000000000419'::uuid, '内田 陽向',   v_par_uchida,    v_illu, '3・4学年',         3,  4),
    ('dddddddd-0000-0000-0000-000000000420'::uuid, '三浦 詩織',   v_par_miura,     v_illu, '5・6学年・中学生', 3,  8),
    ('dddddddd-0000-0000-0000-000000000421'::uuid, '松本 奏',     v_par_matsumoto, v_illu, '1・2学年',         2,  2),
    ('dddddddd-0000-0000-0000-000000000422'::uuid, '松本 一花',   v_par_matsumoto, v_illu, '5・6学年・中学生', 2,  6),
    ('dddddddd-0000-0000-0000-000000000423'::uuid, '木下 大翔',   v_par_kinoshita, v_illu, '5・6学年・中学生', 3,  5),
    ('dddddddd-0000-0000-0000-000000000424'::uuid, '川村 莉子',   v_par_kawamura,  v_illu, '3・4学年',         2,  3),
    ('dddddddd-0000-0000-0000-000000000425'::uuid, '川村 颯',     v_par_kawamura,  v_illu, '1・2学年',         3,  1)
  ) as v(id, name, parent_id, business_id, grade_label, sessions, grade)
  join public.courses c
    on c.business_id = v.business_id
   and c.grade_label = v.grade_label
   and c.sessions_per_month = v.sessions
  on conflict (id) do nothing;

  /* コースの学年区分と回数が合わないと join が空振りして、生徒が黙って作られない。
     気づきにくいのでここで止める。 */
  if (select count(*) from public.students where id::text like 'dddddddd-%') <> 25 then
    raise exception '生徒が25名そろいませんでした（%名）。courses のマスタが想定と違う可能性があります。',
      (select count(*) from public.students where id::text like 'dddddddd-%');
  end if;

  /* きょうだいが事業をまたいでいないことを確かめる。生徒を足すときに壊しやすい。 */
  if exists (select 1 from public.students
              where id::text like 'dddddddd-%'
              group by parent_id having count(distinct business_id) > 1) then
    raise exception 'きょうだいが2つの事業に分かれています。同じ保護者の子は同じ事業にしてください。';
  end if;

  -- ---------------------------------------------------------------- コマ（今月・来月）
  --   今月 = すべて確定（保護者・講師に見えている状態。勤務実績にもなる）
  --   来月 = すべて未確定（希望は出そろっていて、これから確定する状態）
  --   プログラミングは日曜のみ、イラストは土曜・日曜。
  for v_day in
    select d::date from generate_series(
      date_trunc('month', current_date),
      date_trunc('month', current_date) + interval '2 month - 1 day',
      interval '1 day') d
  loop
    for r in
      select bs.business_id, bs.slot_no
        from public.business_slots bs
       where bs.weekday = extract(dow from v_day)::smallint and bs.active
       order by bs.business_id, bs.slot_no
    loop
      v_n := v_n + 1;
      v_sched := ('dddddddd-0000-0000-0000-' || lpad((500000 + v_n)::text, 12, '0'))::uuid;

      /* status は enum。case の分岐は text に解決されてしまい、text から enum への
         暗黙のキャストは無いので、分岐ごとに明示的にキャストする。 */
      insert into public.schedules (id, business_id, session_date, slot_no, status)
      values (v_sched, r.business_id, v_day, r.slot_no,
              case when to_char(v_day, 'YYYY-MM') = v_this_month
                   then 'confirmed'::public.schedule_status
                   else 'draft'::public.schedule_status end)
      on conflict (business_id, session_date, slot_no) do nothing;

      -- 実際に入った id を取り直す（既にあった場合は上の insert が効かない）
      select id into v_sched from public.schedules
       where business_id = r.business_id and session_date = v_day and slot_no = r.slot_no;

      /* 担当講師。その事業の講師から輪番で2名ずつ入れる。
         全員を毎コマ入れると、給与も定員も全講師で同じ値になって確認にならない。
         プログラミングは2名なので結果的に毎コマ全員、イラストは5名から2名ずつ。 */
      insert into public.schedule_employees (schedule_id, employee_id, business_id)
      select v_sched, e.employee_id, r.business_id
        from (
          select eb.employee_id,
                 row_number() over (order by eb.employee_id) as pos,
                 count(*)     over ()                        as total
            from public.employee_businesses eb
           where eb.business_id = r.business_id
             and eb.employee_id::text like 'dddddddd-%'
        ) e
       where (e.pos + v_n) % e.total < 2
      on conflict do nothing;
    end loop;
  end loop;

  /* ---------------------------------------------------- 受講生徒（今月・来月）
     **コースの月回数ぶんだけ入れる。** 全開催日に入れると、生徒25名では
     定員（担当2名 × 係数3 = 6名）をどのコマでも超えるうえ、月2回のコースの生徒が
     月5回通っていることになって料金と食い違う。
     生徒ごとに開始日をずらし、使うコマ番号も交互にすることで、
     1コマあたり2〜3名に散らしつつ「1日1コマ」を保つ。 */
  with day_no as (
    -- 事業 × 月ごとに開催日へ通し番号を振る。日数も一緒に持つ
    select business_id, ym, session_date,
           row_number() over (partition by business_id, ym order by session_date) as day_rn,
           count(*)     over (partition by business_id, ym)                       as days
      from (
        select distinct business_id, to_char(session_date, 'YYYY-MM') as ym, session_date
          from public.schedules
         where id::text like 'dddddddd-%'
      ) d
  ),
  student_no as (
    -- 事業ごとに生徒へ 0 始まりの番号を振る。この番号で割り当てをずらす
    select s.id, s.business_id, c.sessions_per_month,
           row_number() over (partition by s.business_id order by s.id) - 1 as k
      from public.students s
      join public.courses c on c.id = s.course_id
     where s.active and s.id::text like 'dddddddd-%'
  )
  insert into public.schedule_students (schedule_id, student_id, business_id)
  select sc.id, st.id, st.business_id
    from student_no st
    join day_no dn
      on dn.business_id = st.business_id
     and (dn.day_rn + st.k) % dn.days < st.sessions_per_month
    join public.schedules sc
      on sc.business_id  = st.business_id
     and sc.session_date = dn.session_date
     and sc.slot_no      = (st.k % 2) + 1
  on conflict do nothing;

  /* 済んだコマに出欠と授業記録を入れる。欠席の回に記録は付けない（トリガーが落とす）。
     絞り込みは status ではなく日付で行う。今月は月末まで確定済みなので、
     status で絞るとまだ開催していない回にまで出欠が付いてしまう。 */
  for r in
    select ss.schedule_id, ss.student_id, sc.session_date,
           /* 記録者はそのコマの担当講師。事業を兼任する講師はいないので、
              担当から取らないと他事業の講師が記録者になってしまう。 */
           (select se.employee_id from public.schedule_employees se
             where se.schedule_id = ss.schedule_id
             order by se.employee_id limit 1) as employee_id,
           row_number() over (order by sc.session_date, ss.student_id) as rn
      from public.schedule_students ss
      join public.schedules sc on sc.id = ss.schedule_id
     where sc.session_date < current_date
       and sc.id::text like 'dddddddd-%'
  loop
    v_note := case (r.rn % 4)
      when 0 then null
      when 1 then '前回の続きから進めました。集中して取り組めています。'
      when 2 then '新しい課題に入りました。基本の操作は問題なくできています。'
      else        '作品の仕上げに入りました。次回は発表の練習をします。'
    end;

    update public.schedule_students
       set attendance_status = case when r.rn % 3 = 0 then 'absent'::public.attendance_status
                                    when r.rn % 7 = 0 then 'late'::public.attendance_status
                                    else 'present'::public.attendance_status end,
           note = case when r.rn % 3 = 0 then null else v_note end
     where schedule_id = r.schedule_id and student_id = r.student_id;

    /* marked_by / noted_by は上の update と同時に入れられない。
       stamp_attendance・stamp_lesson_note が auth.uid() で上書きするためで、
       SQL Editor には auth.uid() が無いので null になってしまう。
       出欠と所見を変えない2回目の update なら、トリガーは *_by に触らない。 */
    update public.schedule_students
       set marked_by = v_admin,
           noted_by  = case when note is null then null else r.employee_id end
     where schedule_id = r.schedule_id and student_id = r.student_id;
  end loop;

  /* ------------------------------------------------------------ 受講希望（来月）
     コマの割り当てとまったく同じ規則で作る。こうすると来月は
     「希望どおりに仮確定してあるが、まだ確定していない」状態になり、
     確定画面で希望と仮確定が食い違って見えることがない。
     受講回数の上限と「1日1コマ」はトリガーと一意制約が見ているので、
     この規則を崩すとここで落ちる。 */
  with day_no as (
    select business_id, session_date,
           row_number() over (partition by business_id order by session_date) as day_rn,
           count(*)     over (partition by business_id)                       as days
      from (
        select distinct business_id, session_date
          from public.schedules
         where id::text like 'dddddddd-%'
           and to_char(session_date, 'YYYY-MM') = v_next_month
      ) d
  ),
  student_no as (
    select s.id, s.business_id, c.sessions_per_month,
           row_number() over (partition by s.business_id order by s.id) - 1 as k
      from public.students s
      join public.courses c on c.id = s.course_id
     where s.active and s.id::text like 'dddddddd-%'
  )
  insert into public.preferences (id, student_id, year_month, session_date, slot_no)
  select ('dddddddd-0000-0000-0000-' || lpad((600000 + row_number() over ())::text, 12, '0'))::uuid,
         st.id, v_next_month, dn.session_date, ((st.k % 2) + 1)::smallint
    from student_no st
    join day_no dn
      on dn.business_id = st.business_id
     and (dn.day_rn + st.k) % dn.days < st.sessions_per_month
  on conflict do nothing;

  /* 講師の勤務希望（来月）。担当事業の開催日に出す。
     全員が全部の日に出すと確定画面で選ぶ意味が無くなるので、講師ごとに一部の日を落とす。
     希望は日単位で出す想定なので、落とすときはその日の両コマとも落とす。 */
  insert into public.work_preferences (id, employee_id, business_id, year_month, session_date, slot_no)
  select ('dddddddd-0000-0000-0000-' || lpad((700000 + row_number() over ())::text, 12, '0'))::uuid,
         e.employee_id, bs.business_id, v_next_month, d::date, bs.slot_no
    from generate_series(
      date_trunc('month', current_date + interval '1 month'),
      date_trunc('month', current_date + interval '2 month') - interval '1 day',
      interval '1 day') d
    join public.business_slots bs on bs.weekday = extract(dow from d)::smallint and bs.active
    join (
      select eb.employee_id, eb.business_id,
             row_number() over (partition by eb.business_id order by eb.employee_id) as pos
        from public.employee_businesses eb
       where eb.employee_id::text like 'dddddddd-%'
    ) e on e.business_id = bs.business_id
   where (e.pos + extract(day from d)::int) % 4 <> 0   -- 4日に1日は希望を出さない
  on conflict do nothing;

  /* ------------------------------------------------------------ 月謝（今月）
     3人に1人を未納にして、督促の表示を確かめられるようにする。
     1人ぶんは行そのものを作らない = 「請求前」の表示の確認用。
     生徒名で分岐させない（生徒を入れ替えるたびに直すことになるため）。 */
  insert into public.fees (id, student_id, year_month, amount, status, paid_date)
  select ('dddddddd-0000-0000-0000-' || lpad((800000 + t.rn)::text, 12, '0'))::uuid,
         t.id, v_this_month, t.monthly_fee,
         case when t.rn % 3 = 0 then 'unpaid'::public.fee_status
              else 'paid'::public.fee_status end,
         case when t.rn % 3 = 0 then null
              else date_trunc('month', current_date)::date + 9 end
    from (
      select s.id, c.monthly_fee, row_number() over (order by s.id) as rn
        from public.students s
        join public.courses c on c.id = s.course_id
       where s.id::text like 'dddddddd-%'
    ) t
   where t.rn > 1
  on conflict (student_id, year_month) do nothing;

  -- ---------------------------------------------------------------- 欠席連絡
  /* 1件目を未確認、2件目を確認済みにする。
     LIMIT だけで絞ると row_number の並びと一致しないので、番号を付けてから絞る。 */
  insert into public.absence_reports (id, student_id, schedule_id, reason, created_by, handled_at, handled_by)
  select
    ('dddddddd-0000-0000-0000-' || lpad((900000 + a.rn)::text, 12, '0'))::uuid,
    a.student_id, a.schedule_id,
    case when a.rn = 1 then '発熱のためお休みします' else '家族の用事のためお休みします' end,
    a.parent_id,
    case when a.rn = 1 then null else now() end,
    case when a.rn = 1 then null else v_admin end
  from (
    select ss.student_id, sc.id as schedule_id, s.parent_id,
           row_number() over (order by sc.session_date desc, ss.student_id) as rn
      from public.schedule_students ss
      join public.schedules sc on sc.id = ss.schedule_id
      join public.students s   on s.id  = ss.student_id
     where ss.attendance_status = 'absent'
       and sc.id::text like 'dddddddd-%'
  ) a
  where a.rn <= 2
  on conflict do nothing;

  -- ---------------------------------------------------------------- 時間外勤務
  insert into public.overtime_requests
    (id, employee_id, business_id, work_date, description, hours, status, decided_by, decided_at)
  values
    ('dddddddd-0000-0000-0000-000000000951', v_emp_nakamura,  v_prog, current_date - 3, '教材の準備と動作確認',   1.5, 'pending',  null, null),
    ('dddddddd-0000-0000-0000-000000000952', v_emp_kobayashi, v_illu, current_date - 2, '作品講評コメントの作成', 2.0, 'pending',  null, null),
    ('dddddddd-0000-0000-0000-000000000953', v_emp_nakamura,  v_prog, current_date - 9, '保護者面談の資料作成',   1.0, 'approved', v_admin, now() - interval '8 days'),
    ('dddddddd-0000-0000-0000-000000000954', v_emp_watanabe,  v_illu, current_date - 5, '展示用の作品スキャン',   2.5, 'approved', v_admin, now() - interval '4 days'),
    ('dddddddd-0000-0000-0000-000000000955', v_emp_takahashi, v_prog, current_date - 1, '体験会の準備',           1.0, 'rejected', v_admin, now() - interval '12 hours')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- お知らせ
  if v_admin is not null then
    insert into public.announcements (id, title, body, author_id, target_role, business_id, scheduled_at, sent_at)
    values
      ('dddddddd-0000-0000-0000-000000000961',
       '来月の受講希望の受付を開始しました',
       'マイページの「希望提出」から、来月の受講希望を提出してください。締め切りは前月20日です。',
       v_admin, 'parent', null, null, now() - interval '2 days'),
      ('dddddddd-0000-0000-0000-000000000962',
       '発表会のお知らせ',
       '今学期の作品発表会を予定しています。詳細は追ってご連絡します。',
       v_admin, null, null, now() + interval '3 days', null)
    on conflict (id) do nothing;
  end if;

  raise notice 'ダミーデータを投入しました。消すときは dummy_data_cleanup.sql を実行してください。';
end $$;

-- 結果の確認
select '講師'   as 対象, count(*) from public.users where role = 'employee'
-- 講師の内訳はダミーぶんだけ数える（本物が混ざると 2 / 5 にならない）
union all select '  プログラミング教室（2名）', count(*)
         from public.employee_businesses eb
         join public.businesses b on b.id = eb.business_id
        where b.name = 'プログラミング教室' and eb.employee_id::text like 'dddddddd-%'
union all select '  イラスト教室（5名）', count(*)
         from public.employee_businesses eb
         join public.businesses b on b.id = eb.business_id
        where b.name = 'イラスト教室' and eb.employee_id::text like 'dddddddd-%'
union all select '  兼任（0であること）', count(*) from (
         select employee_id from public.employee_businesses
          where employee_id::text like 'dddddddd-%'
          group by employee_id having count(*) > 1) x
union all select '保護者', count(*) from public.users where role = 'parent'
union all select '生徒',   count(*) from public.students
union all select '  プログラミング教室（10名）', count(*)
         from public.students s
         join public.businesses b on b.id = s.business_id
        where b.name = 'プログラミング教室' and s.id::text like 'dddddddd-%'
union all select '  イラスト教室（15名）', count(*)
         from public.students s
         join public.businesses b on b.id = s.business_id
        where b.name = 'イラスト教室' and s.id::text like 'dddddddd-%'
union all select '  きょうだいの事業またぎ（0であること）', count(*) from (
         select parent_id from public.students
          where id::text like 'dddddddd-%'
          group by parent_id having count(distinct business_id) > 1) y
-- 生徒を増やすと真っ先に壊れるところ。定員 = 担当講師数 × 係数
union all select '  定員超過のコマ（0であること）', count(*)
         from public.schedule_capacity
        where is_over_capacity and schedule_id::text like 'dddddddd-%'
union all select 'コマ（今月）', count(*) from public.schedules
         where to_char(session_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
union all select '  うち確定（全部であること）', count(*) from public.schedules
         where to_char(session_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
           and status = 'confirmed'
union all select '  うち出欠マーク済み', count(*)
         from public.schedule_students ss
         join public.schedules sc on sc.id = ss.schedule_id
        where to_char(sc.session_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
          and ss.attendance_status is not null
union all select 'コマ（来月）', count(*) from public.schedules
         where to_char(session_date, 'YYYY-MM') = to_char(current_date + interval '1 month', 'YYYY-MM')
union all select '  うち未確定（全部であること）', count(*) from public.schedules
         where to_char(session_date, 'YYYY-MM') = to_char(current_date + interval '1 month', 'YYYY-MM')
           and status = 'draft'
union all select '受講希望（来月）', count(*) from public.preferences
         where year_month = to_char(current_date + interval '1 month', 'YYYY-MM')
union all select '月謝（今月）', count(*) from public.fees
         where year_month = to_char(current_date, 'YYYY-MM')
union all select '欠席連絡', count(*) from public.absence_reports
union all select '時間外勤務', count(*) from public.overtime_requests
union all select '進級対象', count(*) from public.students_needing_course_change;
