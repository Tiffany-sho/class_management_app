-- =============================================================================
-- 「今月は確定済み・来月はこれから」の状態を作る
--
--   今月（実行日の月）  … 授業はすべて確定。出欠も月謝も入っている
--   来月               … 希望が1件も出ていない。コマもまだ無い。受付は開いている
--
-- **希望提出から確定までを最初から通して試すための状態。** dummy_data.sql は
-- 来月ぶんの希望と仮確定まで作ってしまうので、「保護者が出す → 講師が出す →
-- 管理者が組んで確定する」の入口が最初から埋まっている。ここではその入口を空にする。
--
-- ## 使い方
--
--   node scripts/sql.mjs supabase/dev/dummy_data.sql        -- 先に全体を作る
--   node scripts/sql.mjs supabase/dev/seed_next_month_open.sql
--
-- **dummy_data.sql の後に流す。** 生徒・講師・マスタ・今月ぶんはあちらが作る。
-- ここは来月ぶんを消して、受付が開いていることを確かめるだけ。何度流してもよい。
--
-- ## 消すもの（**すべて来月ぶんだけ**）
--
--   preferences / work_preferences / submissions … 希望と「提出した」記録
--   schedules                                    … コマそのもの（担当・受講は cascade で一緒に消える）
--
-- 今月ぶんには触らない。過去の出欠・授業記録・月謝・給与はそのまま残る。
-- =============================================================================

begin;

do $$
declare
  v_this text := to_char(current_date, 'YYYY-MM');
  v_next text := to_char(current_date + interval '1 month', 'YYYY-MM');
  v_from date := (date_trunc('month', current_date + interval '1 month'))::date;
  v_to   date := (date_trunc('month', current_date + interval '2 month') - interval '1 day')::date;
  n integer;
begin
  ---------------------------------------------------------------- 来月を空にする
  /* 提出した記録から先に消す。**残ったまま希望だけ消すと、本人の画面は
     「希望なしで提出済み」に見えて、出し直すこともできない**状態になる。 */
  delete from public.submissions where year_month = v_next;
  get diagnostics n = row_count;
  raise notice '来月(%)の提出記録を削除: %件', v_next, n;

  delete from public.preferences where year_month = v_next;
  get diagnostics n = row_count;
  raise notice '来月(%)の受講希望を削除: %件', v_next, n;

  delete from public.work_preferences where year_month = v_next;
  get diagnostics n = row_count;
  raise notice '来月(%)の勤務希望を削除: %件', v_next, n;

  /* コマも消す。**希望が無いのにコマだけ残っていると、確定画面に
     「希望は0件なのに仮確定だけ入っているコマ」が並ぶ。**
     担当（schedule_employees）と受講（schedule_students）は
     複合外部キーが on delete cascade なので一緒に消える。 */
  delete from public.absence_reports a
   using public.schedules s
   where s.id = a.schedule_id and s.session_date between v_from and v_to;

  delete from public.schedules where session_date between v_from and v_to;
  get diagnostics n = row_count;
  raise notice '来月(%)のコマを削除: %件', v_next, n;

  ---------------------------------------------------------------- 今月を確定させる
  /* dummy_data.sql は今月を confirmed で作るが、**このスクリプトを
     単体で流したときや、途中で下書きに戻したコマがあったとき**のために揃える。
     draft → confirmed のときだけ通知のトリガーが動くので、
     すでに確定している行は update されない（余計な通知を出さない）。 */
  update public.schedules set status = 'confirmed'
   where to_char(session_date, 'YYYY-MM') = v_this and status = 'draft';
  get diagnostics n = row_count;
  raise notice '今月(%)の未確定コマを確定: %件', v_this, n;

  ---------------------------------------------------------------- 受付を開ける
  /* **締め切り行が無い月は誰も提出できない**（is_submission_open が false）。
     行が無ければルールから作る。 */
  perform public.generate_deadlines(v_next);

  /* 締め切りをもう過ぎていたら先に延ばす。**この seed の目的は「これから
     提出する」状態を作ることなので、過ぎたままでは目的を果たさない。**
     過ぎていないときは触らない（実際の締め切りを勝手に動かさない）。 */
  update public.deadlines
     set deadline_at = (date_trunc('day', now() at time zone 'Asia/Tokyo')
                        + interval '10 days' + interval '23 hours 59 minutes')
                       at time zone 'Asia/Tokyo',
         active = true
   where year_month = v_next
     and (not active or deadline_at <= now());
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '来月(%)の締め切りを10日後に延ばした: %件', v_next, n;
  end if;
end $$;

commit;

-- =============================================================================
-- 確認。**「期待」の列と食い違っていたらこの seed は目的を果たしていない**
-- =============================================================================
select '今月' as 対象, to_char(current_date, 'YYYY-MM') as 年月,
       'コマ' as 項目, count(*)::text as 件数, '1以上' as 期待
  from public.schedules
 where to_char(session_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')

union all
select '今月', to_char(current_date, 'YYYY-MM'),
       '  うち未確定', count(*)::text, '0'
  from public.schedules
 where to_char(session_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
   and status = 'draft'

union all
select '今月', to_char(current_date, 'YYYY-MM'),
       '月謝', count(*)::text, '1以上'
  from public.fees where year_month = to_char(current_date, 'YYYY-MM')

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       'コマ', count(*)::text, '0'
  from public.schedules
 where to_char(session_date, 'YYYY-MM') = to_char(current_date + interval '1 month', 'YYYY-MM')

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       '受講希望', count(*)::text, '0'
  from public.preferences
 where year_month = to_char(current_date + interval '1 month', 'YYYY-MM')

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       '勤務希望', count(*)::text, '0'
  from public.work_preferences
 where year_month = to_char(current_date + interval '1 month', 'YYYY-MM')

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       '提出済み', count(*)::text, '0'
  from public.submissions
 where year_month = to_char(current_date + interval '1 month', 'YYYY-MM')

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       '保護者の受付', public.is_submission_open(
         to_char(current_date + interval '1 month', 'YYYY-MM'), 'parent')::text, 'true'

union all
select '来月', to_char(current_date + interval '1 month', 'YYYY-MM'),
       '講師の受付', public.is_submission_open(
         to_char(current_date + interval '1 month', 'YYYY-MM'), 'employee')::text, 'true';
