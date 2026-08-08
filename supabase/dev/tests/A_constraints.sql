-- =============================================================================
-- A群: CHECK / UNIQUE 制約（31項目）
--
-- ★ 全体を begin 〜 rollback で囲む。データは1行も残らない。
-- ★ 「弾かれること」は **理由まで一致して初めて OK**。別の理由（NOT NULL 違反など）で
--   失敗したのを「弾けた」と読むと、制約が外れていても気づけない。
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
    case when sqlerrm like '%' || want || '%' then '弾いた' else '★別の理由で失敗: ' end
      || substr(sqlerrm, 1, 60));
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
    insert into pg_temp.t_result values (no, item, 'NG', '★弾かれた: ' || substr(sqlerrm, 1, 60));
end $f$;

do $$
declare
  b_prog uuid; b_illu uuid; s_id uuid; p_id uuid; e_id uuid; c_id uuid;
begin
  select id into b_prog from public.businesses where name = 'プログラミング教室';
  select id into b_illu from public.businesses where name = 'イラスト教室';
  select id, parent_id, course_id into s_id, p_id, c_id from public.students order by id limit 1;
  select employee_id into e_id from public.employee_businesses order by employee_id limit 1;

  ---------------------------------------------------------------- business_slots
  perform pg_temp.ng('A01', '曜日は0〜6', format(
    'insert into public.business_slots(business_id,weekday,slot_no,start_time,end_time)'
    || ' values (%L,7,1,''13:00'',''14:30'')', b_prog),
    'business_slots_weekday_check');

  perform pg_temp.ng('A02', '終了時刻は開始より後', format(
    'insert into public.business_slots(business_id,weekday,slot_no,start_time,end_time)'
    || ' values (%L,3,9,''14:30'',''13:00'')', b_prog),
    'business_slots_time_order');

  perform pg_temp.ng('A03', '事業×曜日×コマは一意',
    'insert into public.business_slots(business_id,weekday,slot_no,start_time,end_time)'
    || ' select business_id,weekday,slot_no,start_time,end_time from public.business_slots limit 1',
    'business_slots_unique');

  ---------------------------------------------------------------- businesses
  perform pg_temp.ng('A04', '定員係数は1以上',
    'insert into public.businesses(name,color_key,students_per_employee)'
    || ' values (''テスト事業X'',''forest'',0)',
    'students_per_employee_check');

  perform pg_temp.ng('A05', '事業名は一意',
    'insert into public.businesses(name,color_key) values (''プログラミング教室'',''forest'')',
    'businesses_name_key');

  ---------------------------------------------------------------- courses
  perform pg_temp.ng('A06', '学年の下限≦上限', format(
    'insert into public.courses(business_id,grade_label,grade_min,grade_max,sessions_per_month,monthly_fee)'
    || ' values (%L,''テストX'',5,3,2,1000)', b_prog),
    'courses_grade_range');

  perform pg_temp.ng('A07', '学年上限は9まで', format(
    'insert into public.courses(business_id,grade_label,grade_min,grade_max,sessions_per_month,monthly_fee)'
    || ' values (%L,''テストX'',1,10,2,1000)', b_prog),
    'courses_grade_max_check');

  perform pg_temp.ng('A08', '事業×学年区分×回数は一意',
    'insert into public.courses(business_id,grade_label,grade_min,grade_max,sessions_per_month,monthly_fee)'
    || ' select business_id,grade_label,grade_min,grade_max,sessions_per_month,999 from public.courses limit 1',
    'courses_unique');

  perform pg_temp.ng('A09', '料金は0以上', format(
    'insert into public.courses(business_id,grade_label,grade_min,grade_max,sessions_per_month,monthly_fee)'
    || ' values (%L,''テストY'',1,2,2,-1)', b_prog),
    'courses_monthly_fee_check');

  ---------------------------------------------------------------- year_month の形（5テーブル）
  perform pg_temp.ng('A10a', 'deadlines の年月の形（2026-13）',
    'insert into public.deadlines(year_month,type,deadline_at) values (''2026-13'',''parent'',now())',
    'deadlines_year_month_check');

  perform pg_temp.ng('A10b', 'fees の年月の形（202609）', format(
    'insert into public.fees(student_id,year_month,amount) values (%L,''202609'',1000)', s_id),
    'fees_year_month_check');

  perform pg_temp.ng('A10c', 'payrolls の年月の形（2026-9）', format(
    'insert into public.payrolls(employee_id,year_month) values (%L,''2026-9'')', e_id),
    'payrolls_year_month_check');

  perform pg_temp.ng('A10d', 'preferences の年月の形（2026-00）', format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,''2026-00'',current_date,1)', s_id),
    'preferences_year_month_check');

  /* 形の CHECK には届かない。**先に validate_work_preference が月の不一致で弾く**ため。
     壊れた形の文字列は to_char(date,'YYYY-MM') と一致しようがないので、
     この CHECK は insert/update の経路では実質到達しない（二重の守り）。 */
  perform pg_temp.ng('A10e', 'work_preferences の年月（CHECK より先にトリガーが弾く）', format(
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,''26-09'',current_date,1)', e_id, b_prog),
    '月が一致しません');

  ---------------------------------------------------------------- 締め切り
  perform pg_temp.ng('A11', '締切日は1〜31',
    'insert into public.deadline_rules(type,day_of_month) values (''parent'',32)',
    'day_of_month_check');

  perform pg_temp.ng('A12', '締切ルールは種別ごとに1件',
    'insert into public.deadline_rules(type,day_of_month) values (''parent'',10)',
    'deadline_rules_type_key');

  perform pg_temp.ng('A13', '締切は年月×種別で一意',
    'insert into public.deadlines(year_month,type,deadline_at)'
    || ' select year_month,type,now() from public.deadlines limit 1',
    'deadlines_unique');

  ---------------------------------------------------------------- 月謝
  perform pg_temp.ng('A14', '月謝は生徒×年月で一意',
    'insert into public.fees(student_id,year_month,amount)'
    || ' select student_id,year_month,1 from public.fees limit 1',
    'fees_unique');

  perform pg_temp.ng('A15', '請求額は0以上', format(
    'insert into public.fees(student_id,year_month,amount) values (%L,''1999-01'',-1)', s_id),
    'fees_amount_check');

  ---------------------------------------------------------------- 生徒
  perform pg_temp.ng('A16', '入学年度は2000〜2100', format(
    'insert into public.students(name,parent_id,business_id,course_id,enrollment_year)'
    || ' values (''テスト生徒'',%L,%L,%L,1999)', p_id, b_prog, c_id),
    'enrollment_year_check');

  ---------------------------------------------------------------- 時給・交通費
  perform pg_temp.ng('A17', '時給は講師×事業×開始日で一意（業務名は鍵に入らない）',
    'insert into public.wage_rates(employee_id,business_id,job_label,hourly_rate,effective_from)'
    || ' select employee_id,business_id,''別の業務名'',9999,effective_from from public.wage_rates limit 1',
    'wage_rates_unique');

  perform pg_temp.ng('A18', '時給は0以上', format(
    'insert into public.wage_rates(employee_id,business_id,job_label,hourly_rate,effective_from)'
    || ' values (%L,%L,''テスト'',-1,''1999-01-01'')', e_id, b_prog),
    'hourly_rate_check');

  perform pg_temp.ng('A19', '交通費は講師×開始日で一意',
    'insert into public.commute_allowances(employee_id,daily_amount,effective_from)'
    || ' select employee_id,999,effective_from from public.commute_allowances limit 1',
    'commute_allowances_unique');

  ---------------------------------------------------------------- 希望
  perform pg_temp.ng('A20', '同じ生徒が同じ日に2コマは不可',
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select student_id,year_month,session_date,slot_no+1 from public.preferences limit 1',
    'preferences_one_per_day');

  perform pg_temp.ng('A21', '勤務希望は講師×事業×日×コマで一意',
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' select employee_id,business_id,year_month,session_date,slot_no from public.work_preferences limit 1',
    'work_preferences_unique');

  perform pg_temp.ok('A22', '講師は同じ日の別コマに勤務希望を出せる',
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' select w.employee_id,w.business_id,w.year_month,w.session_date,3-w.slot_no'
    || '   from public.work_preferences w'
    || '  where not exists (select 1 from public.work_preferences x'
    || '                     where x.employee_id=w.employee_id and x.business_id=w.business_id'
    || '                       and x.session_date=w.session_date and x.slot_no=3-w.slot_no)'
    || '  limit 1');

  ---------------------------------------------------------------- コマ
  perform pg_temp.ng('A23', 'コマは事業×日×コマ番号で一意',
    'insert into public.schedules(business_id,session_date,slot_no)'
    || ' select business_id,session_date,slot_no from public.schedules limit 1',
    'schedules_unique');

  perform pg_temp.ok('A24', '同じ日・同じコマ番号でも事業が違えば作れる（日曜の並行開催）', format(
    'insert into public.schedules(business_id,session_date,slot_no)'
    || ' select %L, s.session_date, s.slot_no from public.schedules s'
    || '  where s.business_id=%L and extract(dow from s.session_date)=0'
    || '    and not exists (select 1 from public.schedules x'
    || '                     where x.business_id=%L and x.session_date=s.session_date'
    || '                       and x.slot_no=s.slot_no)'
    || '  limit 1', b_illu, b_prog, b_illu));

  ---------------------------------------------------------------- 連絡・申請・給与
  perform pg_temp.ng('A25', '欠席連絡は生徒×コマで一意',
    'insert into public.absence_reports(student_id,schedule_id,reason)'
    || ' select student_id,schedule_id,''重複'' from public.absence_reports limit 1',
    'absence_reports_unique');

  perform pg_temp.ng('A26', '時間外は0時間より大きい', format(
    'insert into public.overtime_requests(employee_id,business_id,work_date,description,hours)'
    || ' values (%L,%L,current_date,''テスト'',0)', e_id, b_prog),
    'overtime_requests_hours_check');

  perform pg_temp.ng('A27', '給与の金額は0以上', format(
    'insert into public.payrolls(employee_id,year_month,total) values (%L,''1999-01'',-1)', e_id),
    'payrolls_total_check');

  perform pg_temp.ng('A28', 'お知らせの宛先は parent/employee のみ', format(
    'insert into public.announcements(title,body,author_id,target_role)'
    || ' values (''テスト'',''本文'',%L,''admin'')', p_id),
    'target_role_check');

  perform pg_temp.ok('A29', 'お知らせの宛先 null は全ロール向けとして通る', format(
    'insert into public.announcements(title,body,author_id,target_role)'
    || ' values (''テスト'',''本文'',%L,null)', p_id));

  perform pg_temp.ng('A30', 'メールは一意',
    'insert into public.users(id,name,email,role)'
    || ' select gen_random_uuid(),''テスト'',email,''parent'' from public.users limit 1',
    'users_email_key');

  perform pg_temp.ng('A31', 'プッシュの platform は ios/android のみ', format(
    'insert into public.push_tokens(user_id,expo_push_token,platform)'
    || ' values (%L,''tok-test'',''web'')', p_id),
    'push_tokens_platform_check');
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
