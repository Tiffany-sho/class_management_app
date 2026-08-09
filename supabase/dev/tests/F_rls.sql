-- =============================================================================
-- F群: RLS（21項目）
--
-- ★ SQL Editor / この接続は **所有者権限なので RLS を素通りする**。
--   必ず `set local role authenticated` + JWT クレームを差してから数えること。
--   偽装が効いていないまま「全部見えた＝合格」と読むのが一番危ない誤りなので、
--   **F00 で「偽装そのものが効いているか」を先に確かめる**。
--
-- ★ INSERT の拒否は例外になるが、**UPDATE / DELETE の拒否は例外にならず0行になる**。
--   例外だけを見ていると「拒否されたのに合格」を見落とす。行数で判定する。
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

/** そのユーザーとして数える */
create function pg_temp.cnt(uid uuid, q text) returns bigint
language plpgsql as $f$
declare n bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute q into n;
  reset role;
  return n;
exception when others then
  reset role;
  raise;
end $f$;

/** 未ログイン（anon）として数える */
create function pg_temp.cnt_anon(q text) returns bigint
language plpgsql as $f$
declare n bigint;
begin
  set local role anon;
  perform set_config('request.jwt.claims', null, true);
  execute q into n;
  reset role;
  return n;
exception when others then
  reset role;
  return -1;
end $f$;

/** そのユーザーとして書き込みを試す。'ok'（通るはず）/'ng'（拒まれるはず）で判定し、必ず取り消す */
create function pg_temp.wr(no text, item text, uid uuid, stmt text, expect text) returns void
language plpgsql as $f$
declare n bigint; msg text; v_verdict text; v_detail text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  /* UPDATE / DELETE の拒否は例外ではなく **0行** として現れる。
     判定を変数に入れてから ZZ001 で巻き戻す。**先に t_result へ入れると、
     例外ハンドラへの巻き戻しで結果ごと消える**（1度これで結果が欠けた）。 */
  if expect = 'ng' then
    v_verdict := case when n = 0 then 'OK' else 'NG' end;
    v_detail  := case when n = 0 then '0行（拒まれた）' else '★' || n || '行 通ってしまった' end;
  else
    v_verdict := case when n > 0 then 'OK' else 'NG' end;
    v_detail  := case when n > 0 then n || '行 通った' else '★0行（拒まれた）' end;
  end if;
  raise exception using errcode = 'ZZ001';
exception
  when sqlstate 'ZZ001' then
    insert into pg_temp.t_result values (no, item, v_verdict, v_detail);
  when others then
    msg := sqlerrm;
    reset role;
    insert into pg_temp.t_result values (no, item,
      case when expect = 'ng' then 'OK' else 'NG' end,
      case when expect = 'ng' then '拒まれた: ' else '★弾かれた: ' end || substr(msg, 1, 50));
end $f$;

do $$
declare
  p_id uuid; e_id uuid; a_id uuid; other_p uuid; other_e uuid;
  s_mine uuid; s_other uuid; sch_mine uuid; sch_other uuid;
  sch_draft uuid; b_draft uuid; d_draft date;
  nm text; d_sun date; ym text; n bigint;
begin
  -- 子が2人いる保護者
  select parent_id into p_id from public.students group by parent_id order by count(*) desc limit 1;
  select id into s_mine from public.students where parent_id = p_id limit 1;
  select parent_id into other_p from public.students where parent_id <> p_id limit 1;
  select id into s_other from public.students where parent_id = other_p limit 1;
  -- 担当コマを持つ講師
  select se.employee_id, se.schedule_id into e_id, sch_mine
    from public.schedule_employees se limit 1;
  select se2.employee_id into other_e from public.schedule_employees se2
   where se2.employee_id <> e_id limit 1;
  select s.id into sch_other from public.schedules s
   where not exists (select 1 from public.schedule_employees x
                      where x.schedule_id = s.id and x.employee_id = e_id) limit 1;
  select id into a_id from public.users where role = 'admin' order by created_at limit 1;
  nm := to_char(current_date + interval '1 month', 'YYYY-MM');
  ym := to_char(current_date, 'YYYY-MM');
  select min(d)::date into d_sun from generate_series(
    date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', interval '1 day') d
   where extract(dow from d) = 0;

  /* 未確定（draft）のコマを**自分で1つ作る**。
     本番のデータに1つでも draft が残っていることを当てにしていたが、
     全部確定した瞬間に F03 / F04b / F19b が「0件」を見るだけの検査になった
     （F03 は 0 を期待しているので**通ってしまう**）。
     見たい状態は自分で用意する。全部 rollback するので本番には残らない。 */
  select min(d)::date into d_draft from generate_series(
    date_trunc('month', current_date + interval '3 month'),
    date_trunc('month', current_date + interval '4 month') - interval '1 day', interval '1 day') d
   where extract(dow from d) = 0;
  select business_id into b_draft from public.students where id = s_mine;
  insert into public.schedules(business_id, session_date, slot_no, status)
  values (b_draft, d_draft, 1, 'draft')
  returning id into sch_draft;
  insert into public.schedule_students(schedule_id, student_id, business_id)
  values (sch_draft, s_mine, b_draft);

  ---------------------------------------------------------------- 偽装が効いているか
  perform pg_temp.eq('F00', '★偽装そのものが効いているか（全25名が見えたら偽装失敗）',
    (pg_temp.cnt(p_id, 'select count(*) from public.students') <
     (select count(*) from public.students))::text, 'true');

  ---------------------------------------------------------------- 保護者
  perform pg_temp.eq('F01', '保護者: 生徒は自分の子だけ',
    pg_temp.cnt(p_id, 'select count(*) from public.students')::text,
    (select count(*)::text from public.students where parent_id = p_id));

  perform pg_temp.eq('F02', '保護者: 月謝は自分の子だけ',
    pg_temp.cnt(p_id, 'select count(*) from public.fees')::text,
    (select count(*)::text from public.fees f join public.students s on s.id = f.student_id
      where s.parent_id = p_id));

  /* 「見えない」の検査は、**見えるはずのものが在って初めて意味を持つ**。
     draft が1件も無ければ 0 件は当たり前で、ポリシーが外れていても通る。 */
  perform pg_temp.eq('F03a', '★未確定のコマが在る（無いと F03/F04b/F19b は何も検査しない）',
    (select count(*) > 0 from public.schedules where status = 'draft')::text, 'true');

  perform pg_temp.eq('F03', '保護者: 未確定のコマは見えない',
    pg_temp.cnt(p_id, 'select count(*) from public.schedules where status = ''draft''')::text, '0');

  /* ポリシーは is_parent_of(student_id) だけを見ていて、**コマの確定状態は見ていない**。
     そのため未確定（draft）のコマに割り当てられた行も保護者から見える。
     ただし schedules 側が draft を隠すので、日付やコマ番号までは辿れない。
     アプリは schedules から join するので画面には出ない。 */
  perform pg_temp.eq('F04', '保護者: 受講割当は自分の子の行だけ',
    pg_temp.cnt(p_id, 'select count(*) from public.schedule_students')::text,
    (select count(*)::text from public.schedule_students ss
       join public.students s on s.id = ss.student_id
      where s.parent_id = p_id));

  perform pg_temp.eq('F04b', '保護者: 未確定コマの割当行も見える（コマ自体は辿れない）',
    (pg_temp.cnt(p_id,
      'select count(*) from public.schedule_students ss'
      || ' where not exists (select 1 from public.schedules s where s.id = ss.schedule_id)') > 0)::text,
    'true');

  perform pg_temp.wr('F05', '保護者: 他人の子に受講希望を入れられない', p_id, format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,%L,%L,1)', s_other, nm, d_sun), 'ng');

  -- 締切を過ぎた月
  update public.deadlines set deadline_at = now() - interval '1 day' where year_month = nm;
  perform pg_temp.wr('F06a', '保護者: 締切後は受講希望を入れられない', p_id, format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' select %L,%L,d::date,1 from generate_series(%L,%L,interval ''1 day'') d'
    || '  where extract(dow from d)=0'
    || '    and not exists (select 1 from public.preferences p'
    || '                     where p.student_id=%L and p.session_date=d::date) limit 1',
    s_mine, nm, date_trunc('month', current_date + interval '1 month'),
    date_trunc('month', current_date + interval '2 month') - interval '1 day', s_mine), 'ng');

  perform pg_temp.wr('F06b', '保護者: 締切後は受講希望を消せない', p_id, format(
    'delete from public.preferences where student_id=%L and year_month=%L', s_mine, nm), 'ng');

  -- 締切行そのものが無い月
  perform pg_temp.wr('F07', '保護者: 締切行が無い月は入れられない', p_id, format(
    'insert into public.preferences(student_id,year_month,session_date,slot_no)'
    || ' values (%L,''2030-06'',''2030-06-02'',1)', s_mine), 'ng');

  update public.deadlines set deadline_at = now() + interval '10 days' where year_month = nm;

  perform pg_temp.eq('F08a', '保護者: 時給が見えない',
    pg_temp.cnt(p_id, 'select count(*) from public.wage_rates')::text, '0');
  perform pg_temp.eq('F08b', '保護者: 給与が見えない',
    pg_temp.cnt(p_id, 'select count(*) from public.payrolls')::text, '0');

  -- 予約中のお知らせ
  insert into public.announcements(id, title, body, author_id, scheduled_at, sent_at)
  values ('ffffffff-0000-0000-0000-000000000001', '予約中', 'x', a_id,
          now() + interval '3 days', null);
  perform pg_temp.eq('F09', '保護者: 予約中のお知らせは見えない',
    pg_temp.cnt(p_id, 'select count(*) from public.announcements'
      || ' where id = ''ffffffff-0000-0000-0000-000000000001''')::text, '0');

  /* created_by = auth.uid() もポリシーの条件。**入れ忘れると自分の子でも拒まれる**
     （アプリ側で必ず入れること） */
  perform pg_temp.wr('F10a', '保護者: 自分の子の欠席連絡は出せる', p_id, format(
    'insert into public.absence_reports(student_id,schedule_id,reason,created_by)'
    || ' select %L, s.id, ''テスト'', %L from public.schedules s'
    || '  join public.schedule_students ss on ss.schedule_id = s.id and ss.student_id = %L'
    || '  where s.status = ''confirmed'''
    || '    and not exists (select 1 from public.absence_reports a'
    || '                     where a.student_id=%L and a.schedule_id=s.id) limit 1',
    s_mine, p_id, s_mine, s_mine), 'ok');

  perform pg_temp.wr('F10b', '保護者: 他人の子の欠席連絡は出せない', p_id, format(
    'insert into public.absence_reports(student_id,schedule_id,reason,created_by)'
    || ' select %L, s.id, ''テスト'', %L from public.schedules s'
    || '  join public.schedule_students ss on ss.schedule_id = s.id and ss.student_id = %L'
    || '  where not exists (select 1 from public.absence_reports a'
    || '                     where a.student_id=%L and a.schedule_id=s.id) limit 1',
    s_other, p_id, s_other, s_other), 'ng');

  perform pg_temp.wr('F10c', '保護者: created_by を他人にすり替えられない', p_id, format(
    'insert into public.absence_reports(student_id,schedule_id,reason,created_by)'
    || ' select %L, s.id, ''なりすまし'', %L from public.schedules s'
    || '  join public.schedule_students ss on ss.schedule_id = s.id and ss.student_id = %L'
    || '  where not exists (select 1 from public.absence_reports a'
    || '                     where a.student_id=%L and a.schedule_id=s.id) limit 1',
    s_mine, other_p, s_mine, s_mine), 'ng');

  ---------------------------------------------------------------- 講師
  /* schedules は「確定済みなら誰でも見える」。コマの行そのものには個人情報が無く
     （事業・日付・コマ番号・状態だけ）、**誰が担当し誰が受講するかは別テーブルで守る**。
     「自分の担当だけ」に見えるのは、画面が schedule_employees 側から絞っているため。 */
  perform pg_temp.eq('F11a', '講師: 確定済みのコマは全部見える（コマ自体に個人情報は無い）',
    pg_temp.cnt(e_id, 'select count(*) from public.schedules')::text,
    (select count(*)::text from public.schedules where status = 'confirmed'));

  /* 担当の割当は「確定済みのコマなら誰でも見える」＋「未確定でも自分の行は見える」。
     保護者が子のコマの担当講師名を見られる必要があるため（画面の「担当 中村・小林」）。
     講師どうしが同僚の担当を見られるのも、2名体制の相方を知る必要があるので意図どおり。 */
  perform pg_temp.eq('F11b', '講師: 割当は確定済みコマぶん＋未確定の自分の行',
    pg_temp.cnt(e_id, 'select count(*) from public.schedule_employees')::text,
    (select count(*)::text from public.schedule_employees se
       join public.schedules s on s.id = se.schedule_id
      where s.status = 'confirmed' or se.employee_id = e_id));

  perform pg_temp.eq('F11c', '講師: 担当外のコマの受講生徒は見えない',
    pg_temp.cnt(e_id, format(
      'select count(*) from public.schedule_students where schedule_id = %L', sch_other))::text, '0');

  perform pg_temp.wr('F12', '講師: 担当コマの出欠は記録できる', e_id, format(
    'update public.schedule_students set attendance_status=''present'''
    || ' where schedule_id=%L', sch_mine), 'ok');

  perform pg_temp.wr('F13', '講師: 担当外のコマの出欠は記録できない', e_id, format(
    'update public.schedule_students set attendance_status=''present'''
    || ' where schedule_id=%L', sch_other), 'ng');

  perform pg_temp.eq('F14a', '講師: 他人の給与が見えない',
    pg_temp.cnt(e_id, format('select count(*) from public.payrolls where employee_id <> %L', e_id))::text,
    '0');
  perform pg_temp.eq('F14b', '講師: 他人の時給が見えない',
    pg_temp.cnt(e_id, format('select count(*) from public.wage_rates where employee_id <> %L', e_id))::text,
    '0');

  update public.deadlines set deadline_at = now() - interval '1 day'
   where year_month = nm and type = 'employee';
  perform pg_temp.wr('F15', '講師: 締切後は勤務希望を入れられない', e_id, format(
    'insert into public.work_preferences(employee_id,business_id,year_month,session_date,slot_no)'
    || ' select %L, eb.business_id, %L, %L, 1 from public.employee_businesses eb'
    || '  where eb.employee_id=%L'
    || '    and not exists (select 1 from public.work_preferences w'
    || '                     where w.employee_id=%L and w.session_date=%L and w.slot_no=1'
    || '                       and w.business_id=eb.business_id) limit 1',
    e_id, nm, d_sun, e_id, e_id, d_sun), 'ng');
  update public.deadlines set deadline_at = now() + interval '10 days'
   where year_month = nm and type = 'employee';

  perform pg_temp.wr('F16', '講師: 他人名義の時間外は申請できない', e_id, format(
    'insert into public.overtime_requests(employee_id,business_id,work_date,description,hours)'
    || ' select %L, eb.business_id, current_date, ''なりすまし'', 1'
    || '   from public.employee_businesses eb where eb.employee_id=%L limit 1',
    other_e, other_e), 'ng');

  -- 決裁済みの自分の申請は触れない
  insert into public.overtime_requests(id, employee_id, business_id, work_date, description,
                                       hours, status, decided_by, decided_at)
  select 'ffffffff-1111-0000-0000-000000000001', e_id, eb.business_id, current_date,
         '決裁済み', 1, 'approved', a_id, now()
    from public.employee_businesses eb where eb.employee_id = e_id limit 1;
  perform pg_temp.wr('F17a', '講師: 決裁済みの自分の申請は変更できない', e_id,
    'update public.overtime_requests set hours=9'
    || ' where id=''ffffffff-1111-0000-0000-000000000001''', 'ng');
  perform pg_temp.wr('F17b', '講師: 決裁済みの自分の申請は削除できない', e_id,
    'delete from public.overtime_requests'
    || ' where id=''ffffffff-1111-0000-0000-000000000001''', 'ng');

  perform pg_temp.wr('F18', '講師: 他人の役割を変えられない', e_id, format(
    'update public.users set role=''admin'' where id=%L', other_e), 'ng');

  ---------------------------------------------------------------- 管理者
  perform pg_temp.eq('F19a', '管理者: 生徒が全員見える',
    pg_temp.cnt(a_id, 'select count(*) from public.students')::text,
    (select count(*)::text from public.students));
  perform pg_temp.eq('F19b', '管理者: 未確定のコマも見える',
    (pg_temp.cnt(a_id, 'select count(*) from public.schedules where status=''draft''') > 0)::text,
    'true');
  perform pg_temp.eq('F19c', '管理者: 給与が全員ぶん見える',
    (pg_temp.cnt(a_id, 'select count(*) from public.wage_rates') > 0)::text, 'true');
  perform pg_temp.wr('F19d', '管理者: 担当を付け外しできる', a_id, format(
    'delete from public.schedule_employees where schedule_id=%L', sch_mine), 'ok');

  ---------------------------------------------------------------- 通知
  insert into public.notifications(id, user_id, type, title)
  values ('ffffffff-2222-0000-0000-000000000001', p_id, 'test', '自分あて'),
         ('ffffffff-2222-0000-0000-000000000002', other_p, 'test', '他人あて');
  perform pg_temp.eq('F20a', '通知: 自分あてだけ見える',
    pg_temp.cnt(p_id, 'select count(*) from public.notifications'
      || ' where id in (''ffffffff-2222-0000-0000-000000000001'','
      || '               ''ffffffff-2222-0000-0000-000000000002'')')::text, '1');
  perform pg_temp.wr('F20b', '通知: 自分あてを既読にできる', p_id,
    'update public.notifications set read_at=now()'
    || ' where id=''ffffffff-2222-0000-0000-000000000001''', 'ok');
  perform pg_temp.wr('F20c', '通知: 他人あては既読にできない', p_id,
    'update public.notifications set read_at=now()'
    || ' where id=''ffffffff-2222-0000-0000-000000000002''', 'ng');

  ---------------------------------------------------------------- 未ログイン
  perform pg_temp.eq('F21a', '未ログイン: 生徒が見えない',
    pg_temp.cnt_anon('select count(*) from public.students')::text, '0');
  perform pg_temp.eq('F21b', '未ログイン: コマが見えない',
    pg_temp.cnt_anon('select count(*) from public.schedules')::text, '0');
  perform pg_temp.eq('F21c', '未ログイン: 給与が見えない',
    pg_temp.cnt_anon('select count(*) from public.payrolls')::text, '0');
end $$;

select no as 番号, item as 項目, verdict as 判定, detail as 実際
  from pg_temp.t_result order by no;

select count(*) filter (where verdict = 'OK') as 合格,
       count(*) filter (where verdict = 'NG') as 不合格
  from pg_temp.t_result;

rollback;
