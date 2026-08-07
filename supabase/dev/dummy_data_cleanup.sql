-- =============================================================================
-- ダミーデータの削除
--
-- dummy_data.sql が作った行だけを消す。**id が 'dddddddd-' で始まるものだけ**を
-- 対象にしているので、本物のデータが入った後に実行しても本物には触らない。
--
-- 消す順番に意味がある。schedule_employees は employee_businesses を
-- on delete restrict で参照しているため、講師より先にコマを消す必要がある。
-- =============================================================================

begin;

-- 1. コマ（schedule_students / schedule_employees は cascade で一緒に消える）
delete from public.schedules where id::text like 'dddddddd-%';

-- 2. コマに紐づかないもの
delete from public.absence_reports   where id::text like 'dddddddd-%';
delete from public.preferences       where id::text like 'dddddddd-%';
delete from public.work_preferences  where id::text like 'dddddddd-%';
delete from public.fees              where id::text like 'dddddddd-%';
delete from public.overtime_requests where id::text like 'dddddddd-%';
delete from public.announcements     where id::text like 'dddddddd-%';

-- 3. 生徒（schedule_students が消えた後でないと restrict で止まる）
delete from public.students where id::text like 'dddddddd-%';

-- 4. 時給・交通費
delete from public.wage_rates         where id::text like 'dddddddd-%';
delete from public.commute_allowances where id::text like 'dddddddd-%';

-- 5. アカウント（public.users と employee_businesses は cascade で一緒に消える）
delete from auth.users where id::text like 'dddddddd-%';

commit;

-- 残っていないことの確認（すべて 0 になるはず）
select 'ダミーの講師・保護者' as 対象, count(*) as 残り
  from public.users where id::text like 'dddddddd-%'
union all select 'ダミーの生徒',   count(*) from public.students  where id::text like 'dddddddd-%'
union all select 'ダミーのコマ',   count(*) from public.schedules where id::text like 'dddddddd-%'
union all select '本物のユーザー（消えていないこと）', count(*)
  from public.users where id::text not like 'dddddddd-%';
