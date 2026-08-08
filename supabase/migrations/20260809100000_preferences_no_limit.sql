-- =============================================================================
-- 受講希望から「コースの回数まで」「1日1コマまで」の制限を外す
-- =============================================================================
--
-- 変えた理由:
--   受講希望は**予約ではなく候補**である。保護者が「通える日」を出し、その中から
--   コースの回数ぶん（月2回など）を管理者がスケジュール確定で選ぶ、という運用。
--
--   これまでは希望の件数をコースの回数と同じにしないと提出できなかった。これだと
--   保護者は「通える日」ではなく「通う日」を決めることになり、候補が回数ちょうどしか
--   出てこないので、管理者に**調整の余地が無い**（定員が埋まっていても動かせない）。
--
--   同じ理由で「1日1コマまで」も外す。日曜の13:00と15:00のどちらでも良い家庭は、
--   両方を候補に出せたほうが管理者は組みやすい。**実際に何コマ受けるかは
--   `schedule_students`（確定）が決めるので、候補の数は請求にも出席にも影響しない。**
--
-- 残す検査:
--   * 対象年月と希望日の月が一致すること
--   * 在籍事業でその曜日・コマが実際に開催されていること
--   （どちらも「ありえない行」を防ぐもので、運用の都合では変わらない）
--
-- ドメインルール2（docs/domain.md）はこの変更に合わせて書き換えた。
-- 月謝は固定月額なので（ルール3）、候補を何件出しても請求額は変わらない。
-- =============================================================================

create or replace function public.validate_preference()
returns trigger
language plpgsql
as $$
begin
  if to_char(new.session_date, 'YYYY-MM') <> new.year_month then
    raise exception '対象年月(%)と希望日(%)の月が一致しません', new.year_month, new.session_date;
  end if;

  if not exists (
    select 1
      from public.students s
      join public.business_slots bs on bs.business_id = s.business_id
     where s.id = new.student_id
       and bs.weekday = extract(dow from new.session_date)::smallint
       and bs.slot_no = new.slot_no
       and bs.active
  ) then
    raise exception '在籍事業では % の第%コマは開催されていません', new.session_date, new.slot_no;
  end if;

  return new;
end;
$$;

comment on function public.validate_preference() is
  '受講希望の整合性。件数の上限は見ない（希望は候補であって予約ではない）。';

-- 1日1コマの制限を外す。同じ日の別コマも候補に出せる。
-- 代わりに**同じコマを二重に出すこと**は防ぐ（同じ行が2つあっても意味が無い）。
alter table public.preferences drop constraint if exists preferences_one_per_day;

alter table public.preferences
  add constraint preferences_no_duplicate unique (student_id, session_date, slot_no);

comment on constraint preferences_no_duplicate on public.preferences is
  '同じコマを二重に希望しても意味が無いので弾く。1日に2コマ候補を出すのは許す。';
