-- =============================================================================
-- 月謝の発行と、通知の記録
--
-- どちらも「仕組みが無い」ままだったもの。
--   * fees を作る手段がどこにも無く、生徒はいつまでも「請求前」のままだった
--   * notifications テーブルが一度も使われておらず、保護者・講師に何も届かなかった
--
-- 通知は **DB 側で作る**。アプリから作ると、ダッシュボードで直接操作したときや
-- 別の画面から同じ操作をしたときに通知が漏れる。
-- （architecture.md「通知は必ず notifications テーブルに1件作る」）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 月謝の発行
--   コースの月額をコピーして入れる。**既にある行は書き換えない**。
--   管理者が金額を手で直したあとに再実行しても、その修正が消えないようにするため。
-- -----------------------------------------------------------------------------
create or replace function public.generate_fees(p_year_month text default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_month text;
  v_count integer;
begin
  v_month := coalesce(p_year_month, to_char(current_date, 'YYYY-MM'));

  if v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '年月は YYYY-MM の形式で指定してください（受け取った値: %）', v_month;
  end if;

  insert into public.fees (student_id, year_month, amount, status)
  select s.id, v_month, c.monthly_fee, 'unpaid'
    from public.students s
    join public.courses c on c.id = s.course_id
   where s.active
  on conflict (student_id, year_month) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.generate_fees(text) is
  '指定月の月謝を在籍生徒ぶん作る。既存行は書き換えない（手入力した金額を守るため）。';

-- -----------------------------------------------------------------------------
-- 通知を1件作る補助
-- -----------------------------------------------------------------------------
create or replace function public.push_notification(
  p_user_id uuid, p_type text, p_title text, p_body text,
  p_subject_table text default null, p_subject_id uuid default null
)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, subject_table, subject_id)
  select p_user_id, p_type, p_title, p_body, p_subject_table, p_subject_id
   where p_user_id is not null;
$$;

-- -----------------------------------------------------------------------------
-- スケジュール確定 → 保護者と担当講師へ
--
-- **文単位のトリガーにする。** 行単位だと月をまとめて確定したときに、
-- 同じ保護者へコマの数だけ通知が飛ぶ。遷移テーブルを使えば「誰に・どの月ぶんが
-- 確定したか」で1件にまとめられる。
-- -----------------------------------------------------------------------------
create or replace function public.notify_schedule_confirmed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- 保護者（自分の子が入っているコマが確定したとき）
  insert into public.notifications (user_id, type, title, body, subject_table)
  select distinct
         st.parent_id,
         'schedule_confirmed',
         to_char(c.session_date, 'YYYY年FMMM月') || 'の予定が確定しました',
         'マイページの「予定」から確認できます。',
         'schedules'
    from changed c
    join before b            on b.id = c.id and b.status is distinct from c.status
    join public.schedule_students ss on ss.schedule_id = c.id
    join public.students st  on st.id = ss.student_id
   where c.status = 'confirmed';

  -- 担当講師
  insert into public.notifications (user_id, type, title, body, subject_table)
  select distinct
         se.employee_id,
         'schedule_confirmed',
         to_char(c.session_date, 'YYYY年FMMM月') || 'の担当が確定しました',
         'アプリの「予定」から担当コマを確認できます。',
         'schedules'
    from changed c
    join before b on b.id = c.id and b.status is distinct from c.status
    join public.schedule_employees se on se.schedule_id = c.id
   where c.status = 'confirmed';

  return null;
end;
$$;

drop trigger if exists schedules_notify_confirmed on public.schedules;
create trigger schedules_notify_confirmed
  after update on public.schedules
  referencing old table as before new table as changed
  for each statement execute function public.notify_schedule_confirmed();

-- -----------------------------------------------------------------------------
-- 欠席連絡 → 管理者と担当講師へ
-- -----------------------------------------------------------------------------
create or replace function public.notify_absence_reported()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_when text;
begin
  select s.name into v_name from public.students s where s.id = new.student_id;
  select to_char(sc.session_date, 'FMMM月FDD日') || ' 第' || sc.slot_no || 'コマ'
    into v_when
    from public.schedules sc where sc.id = new.schedule_id;

  insert into public.notifications (user_id, type, title, body, subject_table, subject_id)
  select u.id, 'absence_reported',
         coalesce(v_name, '生徒') || ' さんの欠席連絡',
         coalesce(v_when, '') || coalesce('（' || new.reason || '）', ''),
         'absence_reports', new.id
    from public.users u
   where u.active
     and (u.role = 'admin'
          or u.id in (select se.employee_id from public.schedule_employees se
                       where se.schedule_id = new.schedule_id));
  return new;
end;
$$;

drop trigger if exists absence_reports_notify on public.absence_reports;
create trigger absence_reports_notify
  after insert on public.absence_reports
  for each row execute function public.notify_absence_reported();

-- -----------------------------------------------------------------------------
-- 時間外勤務の決裁 → 申請した講師へ
-- -----------------------------------------------------------------------------
create or replace function public.notify_overtime_decided()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = old.status then return new; end if;

  perform public.push_notification(
    new.employee_id,
    'overtime_decided',
    case new.status
      when 'approved' then '時間外勤務の申請が承認されました'
      when 'rejected' then '時間外勤務の申請が却下されました'
      else '時間外勤務の申請の状態が変わりました'
    end,
    to_char(new.work_date, 'FMMM月FDD日') || '・' || new.description
      || '（' || new.hours || '時間）',
    'overtime_requests', new.id);
  return new;
end;
$$;

drop trigger if exists overtime_requests_notify on public.overtime_requests;
create trigger overtime_requests_notify
  after update of status on public.overtime_requests
  for each row execute function public.notify_overtime_decided();

-- -----------------------------------------------------------------------------
-- お知らせの送信 → 対象者へ
--
-- 予約投稿は sent_at が入った時点で送る。send_due_announcements() が
-- sent_at を埋めるので、そこからこのトリガーが動く。
-- -----------------------------------------------------------------------------
create or replace function public.notify_announcement_sent()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.sent_at is null or (tg_op = 'UPDATE' and old.sent_at is not null) then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, subject_table, subject_id)
  select u.id, 'announcement', new.title, new.body, 'announcements', new.id
    from public.users u
   where u.active
     and u.id <> new.author_id
     and (new.target_role is null or u.role = new.target_role)
     and (
       new.business_id is null
       or (u.role = 'parent' and exists (
             select 1 from public.students s
              where s.parent_id = u.id and s.business_id = new.business_id and s.active))
       or (u.role = 'employee' and exists (
             select 1 from public.employee_businesses eb
              where eb.employee_id = u.id and eb.business_id = new.business_id))
     );
  return new;
end;
$$;

drop trigger if exists announcements_notify on public.announcements;
create trigger announcements_notify
  after insert or update of sent_at on public.announcements
  for each row execute function public.notify_announcement_sent();

comment on table public.notifications is
  'すべての通知はここに1件残る。作るのは DB 側のトリガー（アプリから作ると経路が増えて漏れる）。メール・プッシュはこの行を元に送る。';
