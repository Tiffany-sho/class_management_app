-- =============================================================================
-- J群: 締め処理が今までどおり動くか（給与ロックを厳しくした影響の確認）
--
-- lock_confirmed_payroll を「確定済みは一切 UPDATE 不可」に変えたので、
-- **アプリの締め処理（upsert）が巻き添えで壊れていないか**をここで確かめる。
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
    case when sqlerrm like '%' || want || '%' then '止めた: ' else '★別の理由: ' end
      || substr(sqlerrm, 1, 50));
end $f$;

create function pg_temp.ok(no text, item text, stmt text) returns void
language plpgsql as $f$
begin
  execute stmt;
  insert into pg_temp.t_result values (no, item, 'OK', '通った');
exception when others then
  insert into pg_temp.t_result values (no, item, 'NG', '★弾かれた: ' || substr(sqlerrm, 1, 50));
end $f$;

do $$
declare
  ym text; e1 uuid; e2 uuid; a_id uuid; n int; v_total int; v_status text;
begin
  ym := to_char(current_date, 'YYYY-MM');
  select id into a_id from public.users where role = 'admin' order by created_at limit 1;
  select employee_id into e1 from public.employee_monthly_pay
   where year_month = ym order by employee_id limit 1;
  select employee_id into e2 from public.employee_monthly_pay
   where year_month = ym and employee_id <> e1 order by employee_id limit 1;

  ---------------------------------------------------------------- 締める前
  perform pg_temp.eq('J01', '締める前は計算値（draft）で出る',
    (select status::text from public.employee_monthly_pay where employee_id = e1 and year_month = ym),
    'draft');

  ---------------------------------------------------------------- 1名だけ締める（画面の「この講師を確定する」）
  insert into public.payrolls(employee_id, year_month, work_days, work_hours,
                              base_amount, commute, overtime, total, status,
                              confirmed_at, confirmed_by)
  select p.employee_id, p.year_month, p.work_days, p.work_hours, p.base_amount,
         p.commute, p.overtime, p.total, 'confirmed', now(), a_id
    from public.employee_monthly_pay p
   where p.employee_id = e1 and p.year_month = ym;
  perform pg_temp.eq('J02', '1名だけ締められる（他の講師は未確定のまま）',
    (select status::text || '/' ||
       (select status::text from public.employee_monthly_pay where employee_id = e2 and year_month = ym)
       from public.employee_monthly_pay where employee_id = e1 and year_month = ym),
    'confirmed/draft');

  select total into v_total from public.employee_monthly_pay
   where employee_id = e1 and year_month = ym;

  ---------------------------------------------------------------- 締めた後は金額が動かない
  update public.wage_rates set hourly_rate = hourly_rate + 500 where employee_id = e1;
  perform pg_temp.eq('J03', '締めた後は時給を上げても支給額が動かない',
    (select total::text from public.employee_monthly_pay where employee_id = e1 and year_month = ym),
    v_total::text);
  perform pg_temp.eq('J03b', '締めていない講師は時給を上げると支給額が動く',
    (select (total > 0)::text from public.employee_monthly_pay where employee_id = e2 and year_month = ym),
    'true');
  update public.wage_rates set hourly_rate = hourly_rate - 500 where employee_id = e1;

  ---------------------------------------------------------------- 締め直しの経路
  perform pg_temp.ng('J04', '確定済みは upsert でも上書きできない', format(
    'insert into public.payrolls(employee_id,year_month,total,status)'
    || ' values (%L,%L,99999,''confirmed'')'
    || ' on conflict (employee_id,year_month) do update set total=excluded.total', e1, ym),
    '確定済みの給与は変更できません');

  perform pg_temp.ng('J05', '確定済みは削除できない', format(
    'delete from public.payrolls where employee_id=%L and year_month=%L', e1, ym),
    '確定済みの給与は削除できません');

  perform pg_temp.ng('J06', '確定済みを draft に戻せない（今回塞いだ穴）', format(
    'update public.payrolls set status=''draft'' where employee_id=%L and year_month=%L', e1, ym),
    '確定済みの給与は変更できません');

  ---------------------------------------------------------------- 途中まで締めた状態からの続き
  perform pg_temp.ok('J07', '未確定の講師はあとから締められる（途中まで締めた状態の続き）', format(
    'insert into public.payrolls(employee_id,year_month,work_days,work_hours,base_amount,'
    || ' commute,overtime,total,status,confirmed_at,confirmed_by)'
    || ' select p.employee_id,p.year_month,p.work_days,p.work_hours,p.base_amount,'
    || '        p.commute,p.overtime,p.total,''confirmed'',now(),%L'
    || '   from public.employee_monthly_pay p'
    || '  where p.year_month=%L and p.status=''draft''', a_id, ym));

  select count(*) into n from public.employee_monthly_pay
   where year_month = ym and status = 'draft';
  perform pg_temp.eq('J08', '全員締めると未確定が0になる', n::text, '0');

  ---------------------------------------------------------------- draft の行は普通に直せる
  insert into public.payrolls(employee_id, year_month, total, status)
  values (e1, '1997-01', 1000, 'draft');
  perform pg_temp.ok('J09', '未確定（draft）の行はこれまでどおり変更できる', format(
    'update public.payrolls set total=2000 where employee_id=%L and year_month=''1997-01''', e1));
  perform pg_temp.ok('J10', '未確定（draft）の行はこれまでどおり削除できる', format(
    'delete from public.payrolls where employee_id=%L and year_month=''1997-01''', e1));
end $$;

-- 締切が本来どおり作られるか（cron が次に作る月ぶん）
do $$
declare nm text;
begin
  nm := to_char(current_date + interval '2 month', 'YYYY-MM');
  delete from public.deadlines where year_month = nm;
  perform public.generate_deadlines(nm);
  perform pg_temp.eq('J11', format('cron が次に作る %s の締切が日本時間で正しい', nm),
    (select to_char(d.deadline_at at time zone 'Asia/Tokyo', 'DD日 HH24:MI')
       from public.deadlines d where d.year_month = nm and d.type = 'parent'),
    (select lpad(r.day_of_month::text, 2, '0') || '日 ' || to_char(r.time_of_day, 'HH24:MI')
       from public.deadline_rules r where r.type = 'parent'));
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
