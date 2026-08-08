-- =============================================================================
-- G群: 通知トリガー（9項目） / H群: 外部キーの削除挙動（8項目） / I群: 運用（5項目）
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

-- ============================== G: 通知 ==============================
do $$
declare
  nm text; n0 bigint; n1 bigint; slots int; targets int;
  a_id uuid; e_id uuid; b_id uuid; s_id uuid; p_id uuid; sch uuid;
begin
  nm := to_char(current_date + interval '1 month', 'YYYY-MM');
  select id into a_id from public.users where role = 'admin' order by created_at limit 1;

  ---------------------------------------------------------------- G1: 文単位トリガー
  select count(*) into n0 from public.notifications;
  select count(*) into slots from public.schedules
   where to_char(session_date, 'YYYY-MM') = nm and status = 'draft';
  update public.schedules set status = 'confirmed'
   where to_char(session_date, 'YYYY-MM') = nm and status = 'draft';
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G01', format('月まとめて確定（%sコマ）でも通知は対象者ごとに1件', slots),
    format('%sコマ更新 → 通知%s件', slots, n1 - n0),
    format('%sコマ更新 → 通知%s件', slots,
      (select count(distinct u.id) from public.users u
        where u.active and u.role in ('parent','employee'))));

  ---------------------------------------------------------------- G2: 再確定では出ない
  select count(*) into n0 from public.notifications;
  update public.schedules set status = 'confirmed'
   where to_char(session_date, 'YYYY-MM') = nm;
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G02', '既に確定済みを再更新しても通知は増えない', (n1 - n0)::text, '0');

  ---------------------------------------------------------------- G3: 欠席連絡
  select ss.student_id, ss.schedule_id into s_id, sch
    from public.schedule_students ss
    join public.schedules s on s.id = ss.schedule_id
   where s.status = 'confirmed'
     and exists (select 1 from public.schedule_employees se where se.schedule_id = s.id)
     and not exists (select 1 from public.absence_reports a
                      where a.student_id = ss.student_id and a.schedule_id = ss.schedule_id)
   limit 1;
  select parent_id into p_id from public.students where id = s_id;
  select count(*) into n0 from public.notifications;
  insert into public.absence_reports(student_id, schedule_id, reason, created_by)
  values (s_id, sch, 'テスト欠席', p_id);
  select count(*) into n1 from public.notifications;
  select count(*) into targets from (
    select id from public.users where role = 'admin' and active
    union
    select se.employee_id from public.schedule_employees se where se.schedule_id = sch) x;
  perform pg_temp.eq('G03', '欠席連絡: 管理者全員＋そのコマの担当講師に届く',
    (n1 - n0)::text, targets::text);

  ---------------------------------------------------------------- G4 / G5: 時間外の決裁
  select eb.employee_id, eb.business_id into e_id, b_id from public.employee_businesses eb limit 1;
  insert into public.overtime_requests(id, employee_id, business_id, work_date, description, hours)
  values ('aaaaaaaa-0000-0000-0000-000000000001', e_id, b_id, current_date, 'テスト', 1);

  select count(*) into n0 from public.notifications;
  update public.overtime_requests set description = '説明だけ変える'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G05', '時間外: 決裁していない更新では通知が出ない', (n1 - n0)::text, '0');

  select count(*) into n0 from public.notifications;
  update public.overtime_requests set status = 'approved', decided_by = a_id, decided_at = now()
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G04', '時間外: 決裁すると申請者に1件届く', (n1 - n0)::text, '1');

  ---------------------------------------------------------------- G6〜G8: お知らせ
  select count(*) into n0 from public.notifications;
  insert into public.announcements(title, body, author_id, target_role, sent_at)
  values ('保護者向け', 'x', a_id, 'parent', now());
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G06', 'お知らせ: 宛先が保護者なら保護者全員に届く', (n1 - n0)::text,
    (select count(*)::text from public.users where role = 'parent' and active));

  select count(*) into n0 from public.notifications;
  insert into public.announcements(title, body, author_id, target_role, sent_at)
  values ('全員向け', 'x', a_id, null, now());
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G07', 'お知らせ: 宛先 null なら保護者・講師の両方に届く', (n1 - n0)::text,
    (select count(*)::text from public.users where role in ('parent','employee') and active));

  select count(*) into n0 from public.notifications;
  insert into public.announcements(title, body, author_id, target_role, business_id, sent_at)
  values ('事業限定', 'x', a_id, null, b_id, now());
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G08', 'お知らせ: 事業を指定するとその事業の関係者だけ',
    ((n1 - n0) < (select count(*) from public.users where role in ('parent','employee') and active))::text,
    'true');

  ---------------------------------------------------------------- G9: 予約は届かない
  select count(*) into n0 from public.notifications;
  insert into public.announcements(id, title, body, author_id, scheduled_at, sent_at)
  values ('aaaaaaaa-1111-0000-0000-000000000001', '予約', 'x', a_id,
          now() - interval '1 hour', null);
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G09a', 'お知らせ: 予約中（未送信）では通知が出ない', (n1 - n0)::text, '0');

  perform public.send_due_announcements();
  select count(*) into n1 from public.notifications;
  perform pg_temp.eq('G09b', 'お知らせ: 送信処理を通すと届く', ((n1 - n0) > 0)::text, 'true');
end $$;

-- ============================== H: 外部キーの削除挙動 ==============================
do $$
declare s_id uuid; e_id uuid; b_id uuid; p_id uuid; sch uuid; au uuid; n bigint; n2 bigint;
begin
  select f.student_id into s_id from public.fees f limit 1;
  select se.employee_id, se.schedule_id into e_id, sch from public.schedule_employees se limit 1;
  select id into b_id from public.businesses limit 1;
  select parent_id into p_id from public.students limit 1;

  -- 月謝以外（受講割当・受講希望）の外部キーが先に止めることもある。どれでも「止まる」ことが要件
  perform pg_temp.ng('H01', '実績のある生徒は消せない',
    format('delete from public.students where id = %L', s_id), 'violates foreign key');

  perform pg_temp.ng('H02', '担当コマのある講師は消せない',
    format('delete from public.users where id = %L', e_id), 'violates foreign key');

  perform pg_temp.ng('H03', 'コマのある事業は消せない',
    format('delete from public.businesses where id = %L', b_id), 'violates foreign key');

  perform pg_temp.ng('H04', '子のいる保護者は消せない',
    format('delete from public.users where id = %L', p_id), 'students_parent_id_fkey');

  -- H05: auth.users を消すと public.users も消える
  select id into au from public.users where role = 'parent'
    and not exists (select 1 from public.students s where s.parent_id = public.users.id) limit 1;
  if au is null then
    perform pg_temp.eq('H05', 'auth.users を消すと public.users も消える（対象なしで省略）', 'skip', 'skip');
  else
    delete from auth.users where id = au;
    perform pg_temp.eq('H05', 'auth.users を消すと public.users も消える',
      (select count(*)::text from public.users where id = au), '0');
  end if;

  -- H06: コマを消すと担当・受講・欠席連絡が消える
  select count(*) into n from public.schedule_students where schedule_id = sch;
  delete from public.schedules where id = sch;
  select count(*) into n2 from public.schedule_students where schedule_id = sch;
  perform pg_temp.eq('H06', 'コマを消すと担当・受講の割当も消える',
    format('割当%s件 → %s件', n, n2), format('割当%s件 → 0件', n));

  -- H07: 記録者ユーザーを消すと noted_by が null になり、記録本体は残る
  perform pg_temp.eq('H07', '記録者を消しても記録本体は残る（noted_by が null になる）',
    (select count(*)::text from pg_constraint
      where conname = 'schedule_students_noted_by_fkey' and confdeltype = 'n'), '1');

  -- H08: 担当できる事業を外す（コマあり）
  perform pg_temp.ng('H08', '担当コマのある事業は「担当できる事業」から外せない',
    format('delete from public.employee_businesses where employee_id = %L', e_id),
    'violates foreign key');
end $$;

-- ============================== I: 運用 ==============================
do $$
declare n int; jobs text; tz text;
begin
  -- I1: 新しいテーブルに RLS が自動で付くか
  create table public.zz_rls_probe(id int);
  perform pg_temp.eq('I01', '新しいテーブルは RLS が自動で有効になる',
    (select relrowsecurity::text from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relname = 'zz_rls_probe'), 'true');
  drop table public.zz_rls_probe;

  -- I2 / I3: pg_cron
  select count(*) into n from pg_extension where extname = 'pg_cron';
  perform pg_temp.eq('I02a', 'pg_cron 拡張が入っている', (n > 0)::text, 'true');
  if n > 0 then
    execute 'select string_agg(jobname || '' @ '' || schedule, '' / '' order by jobname) from cron.job'
      into jobs;
    perform pg_temp.eq('I02b', 'cron に2本とも登録されている',
      coalesce(jobs, 'ジョブ0件'),
      'generate-deadlines @ 5 0 1 * * / send-announcements @ */5 * * * *');
  end if;
  perform pg_temp.eq('I03', 'cron の時刻は UTC（JST とずれることを踏まえた設定か）',
    current_setting('TimeZone'), 'UTC');

  -- I4: 全テーブルで RLS 有効
  perform pg_temp.eq('I04', 'RLS が無効なテーブルは無い',
    (select coalesce(string_agg(c.relname, ', '), 'なし')
       from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'なし');

  -- I5: ビューは security_invoker（RLS を素通りしない）
  perform pg_temp.eq('I05', 'ビューが security_invoker でない、が無い',
    (select coalesce(string_agg(c.relname, ', '), 'なし')
       from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'v'
        and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'),
    'なし');
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
