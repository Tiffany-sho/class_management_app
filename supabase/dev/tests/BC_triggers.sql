-- =============================================================================
-- B群: 検証トリガー（12項目） / C群: 自動記入トリガー（12項目）
-- 全体を begin 〜 rollback で囲む。データは1行も残らない。
-- =============================================================================
begin;

create temp table t_result(no text, item text, verdict text, detail text);

create function pg_temp.ng(no text, item text, stmt text, want text) returns void
language plpgsql as $f$
begin
  execute stmt;
  insert into pg_temp.t_result values (no, item, 'NG', '★通ってしまった');
exception when others then
  insert into pg_temp.t_result values (no, item,
    case when sqlerrm like '%' || want || '%' then 'OK' else 'NG' end,
    case when sqlerrm like '%' || want || '%' then '弾いた: ' else '★別の理由で失敗: ' end
      || substr(sqlerrm, 1, 55));
end $f$;

create function pg_temp.ok(no text, item text, stmt text) returns void
language plpgsql as $f$
begin
  execute stmt;
  raise exception using errcode = 'ZZ001', message = 'undo';
exception
  when sqlstate 'ZZ001' then
    insert into pg_temp.t_result values (no, item, 'OK', '通った（取り消し済み）');
  when others then
    insert into pg_temp.t_result values (no, item, 'NG', '★弾かれた: ' || substr(sqlerrm, 1, 55));
end $f$;

create function pg_temp.eq(no text, item text, actual text, expected text) returns void
language plpgsql as $f$
begin
  insert into pg_temp.t_result values (no, item,
    case when actual is not distinct from expected then 'OK' else 'NG' end,
    case when actual is not distinct from expected then coalesce(actual, '(null)')
         else '★' || coalesce(actual, '(null)') || ' ≠ ' || coalesce(expected, '(null)') end);
end $f$;

-- ============================== B: 検証トリガー ==============================
do $$
declare
  b_prog uuid; b_illu uuid; e_prog uuid; s_prog uuid; ym text; nm text;
  d_sun date; d_mon date; lim int; cnt int; pid uuid;
begin
  select id into b_prog from public.businesses where name = 'プログラミング教室';
  select id into b_illu from public.businesses where name = 'イラスト教室';
  select eb.employee_id into e_prog from public.employee_businesses eb where eb.business_id = b_prog limit 1;
  select s.id into s_prog from public.students s where s.business_id = b_prog and s.active limit 1;

  nm := to_char(current_date + interval '1 month', 'YYYY-MM');
  -- 来月の日曜と月曜
  select min(d)::date into d_sun from generate_series(
    date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', interval '1 day') d
   where extract(dow from d) = 0;
  select min(d)::date into d_mon from generate_series(
    date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', interval '1 day') d
   where extract(dow from d) = 1;

  /* この生徒の希望をいったん全部消す。ダミーデータで既に入っていると、
     検証トリガーに届く前に「1日1コマ」の一意制約が先に弾いてしまい、
     何を確かめたのか分からない結果になる。 */
  delete from public.preferences where student_id = s_prog;

  ---------------------------------------------------------------- validate_preference
  perform pg_temp.ng('B01', '受講希望: 年月と日付の月が違う', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,1)', s_prog, to_char(current_date, 'YYYY-MM'), d_sun),
    '月が一致しません');

  perform pg_temp.ng('B02', '受講希望: 開催のない曜日（月曜）', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,1)', s_prog, nm, d_mon),
    '開催されていません');

  perform pg_temp.ng('B02b', '受講希望: 開催のないコマ番号（第9コマ）', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,9)', s_prog, nm, d_sun),
    '開催されていません');

  -- 在籍していない事業の日（プログラミングの生徒を、土曜=イラストのみの日に出す）
  perform pg_temp.ng('B03', '受講希望: 在籍しない事業の開催日（土曜）', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select %L,%L,d::date,1 from generate_series(%L::date, %L::date + 20, interval ''1 day'') d'
    || '  where extract(dow from d)=6 limit 1',
    s_prog, nm, date_trunc('month', current_date + interval '1 month')::date,
    date_trunc('month', current_date + interval '1 month')::date),
    '開催されていません');

  -- 上限。いまの希望を全部消してから、上限ちょうど→上限+1 を試す
  select c.sessions_per_month into lim
    from public.students s join public.courses c on c.id = s.course_id where s.id = s_prog;
  delete from public.preferences where student_id = s_prog and year_month = nm;

  insert into public.preferences(student_id, year_month, session_date, slot_no)
  select s_prog, nm, d::date, 1
    from generate_series(date_trunc('month', current_date + interval '1 month'),
                         date_trunc('month', current_date + interval '2 month') - interval '1 day',
                         interval '1 day') d
   where extract(dow from d) = 0 limit lim;
  select count(*) into cnt from public.preferences where student_id = s_prog and year_month = nm;
  perform pg_temp.eq('B05', format('受講希望: 上限ちょうど（%s件）は通る', lim), cnt::text, lim::text);

  perform pg_temp.ng('B04', '受講希望: 上限を1件超える', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select %L,%L,d::date,1 from generate_series(%L,%L,interval ''1 day'') d'
    || '  where extract(dow from d)=0'
    || '    and not exists (select 1 from public.preferences p where p.student_id=%L and p.session_date=d::date)'
    || '  limit 1',
    s_prog, nm, date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', s_prog),
    '上限を超えています');

  -- 差し替え: 先に消す→足す は通る
  perform pg_temp.ok('B06', '上限のまま「先に消して→足す」は通る', format(
    'with gone as (delete from public.preferences where student_id=%L and year_month=%L'
    || '            and session_date=(select min(session_date) from public.preferences'
    || '                               where student_id=%L and year_month=%L) returning 1)'
    || ' insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select %L,%L,d::date,1 from gone, generate_series(%L,%L,interval ''1 day'') d'
    || '  where extract(dow from d)=0'
    || '    and not exists (select 1 from public.preferences p where p.student_id=%L and p.session_date=d::date)'
    || '  limit 1',
    s_prog, nm, s_prog, nm, s_prog, nm,
    date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', s_prog));

  -- 先に足す は弾かれる（B04 と同じ理由。順番に依存することの確認）
  perform pg_temp.ng('B07', '上限のまま「先に足す」は弾かれる（順番の依存）', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select %L,%L,d::date,1 from generate_series(%L,%L,interval ''1 day'') d'
    || '  where extract(dow from d)=0'
    || '    and not exists (select 1 from public.preferences p where p.student_id=%L and p.session_date=d::date)'
    || '  limit 1',
    s_prog, nm, date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', s_prog),
    '上限を超えています');

  ---------------------------------------------------------------- validate_work_preference
  perform pg_temp.ng('B08', '勤務希望: 年月と日付の月が違う', format(
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,%L,1)', e_prog, b_prog, to_char(current_date, 'YYYY-MM'), d_sun),
    '月が一致しません');

  perform pg_temp.ng('B09', '勤務希望: その事業で開催のない曜日', format(
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,%L,1)', e_prog, b_prog, nm, d_mon),
    '開催されていません');

  perform pg_temp.ng('B10', '勤務希望: 担当できない事業（複合外部キー）', format(
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,%L,1)', e_prog, b_illu, nm, d_sun),
    'work_preferences_employee_business_fk');

  ---------------------------------------------------------------- validate_schedule
  perform pg_temp.ng('B11', 'コマ: 開催枠にない曜日×コマ', format(
    'insert into public.schedules(business_id,session_date,slot_no) values (%L,%L,1)', b_prog, d_mon),
    '開催されていません');

  -- active=false の枠は「無い」と同じ扱いか
  update public.business_slots set active = false
   where business_id = b_prog and weekday = 0 and slot_no = 1;
  perform pg_temp.ng('B12', 'コマ: 停止中（active=false）の開催枠', format(
    'insert into public.schedules(business_id,session_date,slot_no)'
    || ' values (%L,%L::date + 7,1)', b_prog, d_sun),
    '開催されていません');
  update public.business_slots set active = true
   where business_id = b_prog and weekday = 0 and slot_no = 1;
end $$;

-- ============================== C: 自動記入トリガー ==============================
do $$
declare
  sch uuid; stu uuid; uid uuid; v_at timestamptz; v_by uuid; v_note text; v_up timestamptz;
  admin_id uuid; other_id uuid;
begin
  select id into admin_id from public.users where role = 'admin' order by created_at limit 1;
  -- 「別の人が操作した」ことにするための実在ユーザー（noted_by は外部キーなので実在が要る）
  select id into other_id from public.users where role = 'employee' order by id limit 1;
  -- auth.uid() を偽装する（stamp 系はこれを書き込む）
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id::text, 'role', 'authenticated')::text, true);

  select ss.schedule_id, ss.student_id into sch, stu
    from public.schedule_students ss
    join public.schedules s on s.id = ss.schedule_id
   where s.session_date < current_date
   limit 1;

  -- C1: 出欠を UPDATE するとスタンプが押される
  update public.schedule_students set attendance_status = 'late'
   where schedule_id = sch and student_id = stu;
  select marked_at, marked_by into v_at, v_by
    from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C01', '出欠を変えると marked_at が入る',
    (v_at is not null)::text, 'true');
  perform pg_temp.eq('C01b', '出欠を変えると marked_by に操作者が入る',
    (v_by = admin_id)::text, 'true');

  -- C2: null に戻すとスタンプも消える
  update public.schedule_students set attendance_status = null
   where schedule_id = sch and student_id = stu;
  select marked_at, marked_by into v_at, v_by
    from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C02', '出欠を null に戻すとスタンプも消える',
    (v_at is null and v_by is null)::text, 'true');

  -- C3: 出欠を変えずに他列を UPDATE してもスタンプは動かない
  update public.schedule_students set attendance_status = 'present'
   where schedule_id = sch and student_id = stu;
  select marked_by into v_by from public.schedule_students where schedule_id = sch and student_id = stu;
  perform set_config('request.jwt.claims',
    json_build_object('sub', other_id::text, 'role', 'authenticated')::text, true);
  update public.schedule_students set note = '出欠は変えずに所見だけ'
   where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C03', '出欠を変えない更新では marked_by が書き換わらない',
    (select (marked_by = v_by)::text from public.schedule_students
      where schedule_id = sch and student_id = stu), 'true');
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id::text, 'role', 'authenticated')::text, true);

  -- C4: INSERT ではスタンプが押されない（UPDATE 専用トリガー）
  delete from public.schedule_students where schedule_id = sch and student_id = stu;
  insert into public.schedule_students(schedule_id, student_id, business_id, attendance_status)
  select sch, stu, s.business_id, 'present' from public.schedules s where s.id = sch;
  select marked_at into v_at from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C04', 'INSERT で出欠を入れてもスタンプは押されない（既知の仕様）',
    coalesce(v_at::text, 'null'), 'null');

  -- C5: 所見のスタンプ
  update public.schedule_students set note = 'テストの所見'
   where schedule_id = sch and student_id = stu;
  select noted_at, noted_by into v_at, v_by
    from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C05', '所見を書くと noted_at / noted_by が入る',
    (v_at is not null and v_by = admin_id)::text, 'true');

  -- C6: 欠席にすると所見が落ちる
  update public.schedule_students set attendance_status = 'absent', note = '書けないはず'
   where schedule_id = sch and student_id = stu;
  select note into v_note from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C06', '欠席にすると所見が落ちる', coalesce(v_note, 'null'), 'null');

  -- C7: 所見を null にすると noted_* も消える
  update public.schedule_students set attendance_status = 'present', note = 'いったん書く'
   where schedule_id = sch and student_id = stu;
  update public.schedule_students set note = null
   where schedule_id = sch and student_id = stu;
  select noted_at, noted_by into v_at, v_by
    from public.schedule_students where schedule_id = sch and student_id = stu;
  perform pg_temp.eq('C07', '所見を消すと noted_at / noted_by も消える',
    (v_at is null and v_by is null)::text, 'true');
end $$;

-- C8: set_updated_at が全テーブルで効くか
do $$
declare t text; before timestamptz; after timestamptz; bad text := '';
begin
  foreach t in array array['users','businesses','business_slots','courses','students',
                           'schedules','schedule_students','preferences','work_preferences',
                           'fees','wage_rates','commute_allowances','deadlines','deadline_rules',
                           'overtime_requests','announcements','payrolls','push_tokens']
  loop
    begin
      execute format('select updated_at from public.%I limit 1', t) into before;
      if before is null then continue; end if;
      execute format('update public.%I set updated_at = ''2000-01-01'' where ctid = (select ctid from public.%I limit 1)', t, t);
      execute format('select updated_at from public.%I where ctid = (select ctid from public.%I limit 1)', t, t) into after;
      if after <= '2000-01-02'::timestamptz then bad := bad || t || ' '; end if;
    exception when others then bad := bad || t || '(' || substr(sqlerrm,1,20) || ') ';
    end;
  end loop;
  perform pg_temp.eq('C08', 'updated_at が自動で進む（18テーブル）',
    case when bad = '' then 'すべて進む' else '★進まない: ' || bad end, 'すべて進む');
end $$;

-- C9〜C12: 確定済み給与のロック
do $$
declare e_id uuid;
begin
  select employee_id into e_id from public.employee_businesses limit 1;
  insert into public.payrolls(employee_id, year_month, work_days, work_hours,
                              base_amount, commute, overtime, total, status, confirmed_at)
  values (e_id, '1999-12', 1, 1.5, 1000, 0, 0, 1000, 'confirmed', now());

  perform pg_temp.ng('C09', '確定済みの金額は変更できない', format(
    'update public.payrolls set total=9999 where employee_id=%L and year_month=''1999-12''', e_id),
    '確定済みの給与は変更できません');

  perform pg_temp.ng('C10', '確定済みは削除できない', format(
    'delete from public.payrolls where employee_id=%L and year_month=''1999-12''', e_id),
    '確定済みの給与は削除できません');

  -- ★ 抜け道: status を draft に戻せてしまう
  perform pg_temp.ng('C11', '確定済みを draft に戻せない（★抜け道の確認）', format(
    'update public.payrolls set status=''draft'' where employee_id=%L and year_month=''1999-12''', e_id),
    '確定済みの給与は変更できません');

  perform pg_temp.ng('C12', 'draft に戻した後も金額を変えられない（★抜け道の確認）', format(
    'update public.payrolls set total=9999 where employee_id=%L and year_month=''1999-12''', e_id),
    '確定済みの給与は変更できません');
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
