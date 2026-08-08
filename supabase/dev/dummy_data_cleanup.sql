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

-- **id ではなく関係でたどって消す。** 月謝は generate_fees が作るので id が
-- 'dddddddd-' で始まらない。id だけで消すと取り残されて外部キーに引っかかる。
delete from public.schedule_students   where student_id::text  like 'dddddddd-%';
delete from public.schedule_employees  where employee_id::text like 'dddddddd-%';
delete from public.absence_reports     where student_id::text  like 'dddddddd-%';
delete from public.schedules           where id::text          like 'dddddddd-%';
delete from public.preferences         where student_id::text  like 'dddddddd-%';
delete from public.work_preferences    where employee_id::text like 'dddddddd-%';
delete from public.fees                where student_id::text  like 'dddddddd-%';
delete from public.overtime_requests   where employee_id::text like 'dddddddd-%';
delete from public.announcements       where id::text          like 'dddddddd-%';
delete from public.notifications       where user_id::text     like 'dddddddd-%';
delete from public.students            where id::text          like 'dddddddd-%';
delete from public.wage_rates          where employee_id::text like 'dddddddd-%';
delete from public.commute_allowances  where employee_id::text like 'dddddddd-%';
delete from public.employee_businesses where employee_id::text like 'dddddddd-%';

-- アカウント（public.users と employee_businesses は cascade で一緒に消える）
delete from auth.identities where user_id::text like 'dddddddd-%';
delete from auth.users      where id::text      like 'dddddddd-%';

commit;

-- 残っていないことの確認（すべて 0 になるはず）
select 'ダミーの講師・保護者' as 対象, count(*) as 残り
  from public.users where id::text like 'dddddddd-%'
union all select 'ダミーの生徒',   count(*) from public.students  where id::text like 'dddddddd-%'
union all select 'ダミーのコマ',   count(*) from public.schedules where id::text like 'dddddddd-%'
union all select '本物のユーザー（消えていないこと）', count(*)
  from public.users where id::text not like 'dddddddd-%';
