-- =============================================================================
-- 通知本文の日付が「8月F02日」になるのを直す
-- =============================================================================
--
-- 原因: `to_char(日付, 'FMMM月FDD日')` の `FDD`。
--   `FM` は「詰める（先頭の0を落とす）」の指示で、**2文字で1つ**。`FDD` は
--   `FM` ではなく **文字 `F` + パターン `DD`** と解釈されるので、`F` がそのまま
--   出力に残り、日は 0 詰めのまま（`F02`）になる。正しくは `FMDD`。
--
--     to_char(date '2026-08-02', 'FMMM月FDD日')  → '8月F02日'
--     to_char(date '2026-08-02', 'FMMM月FMDD日') → '8月2日'
--
--   同じ行にある `FMMM` は正しく効いていたので、月だけ詰められて日は詰められない、
--   という中途半端な出力になっていた。
--
-- 出る場所: 欠席連絡（管理者と担当講師へ）と、時間外勤務の決裁（申請した講師へ）。
--   どちらも「お知らせ」タブにそのまま出る。
--
-- 既に作られてしまった行も直す（下の update）。通知は作り直せないので、
-- 関数だけ直しても過去ぶんは壊れたまま残る。
-- =============================================================================

create or replace function public.notify_absence_reported()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_when text;
begin
  select s.name into v_name from public.students s where s.id = new.student_id;
  select to_char(sc.session_date, 'FMMM月FMDD日') || ' 第' || sc.slot_no || 'コマ'
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
    to_char(new.work_date, 'FMMM月FMDD日') || '・' || new.description
      || '（' || new.hours || '時間）',
    'overtime_requests', new.id);
  return new;
end;
$$;

-- 既に配ってしまった通知の本文を直す。
--   「8月F02日」→「8月2日」。`月F` のあとの 0 詰めも一緒に落とす
--   （FMDD なら 0 詰めにならないので、直したあとの見え方に揃える）。
update public.notifications
   set body = regexp_replace(body, '月F0*(\d+)日', '月\1日', 'g')
 where body ~ '月F\d';
