-- =============================================================================
-- R-Tech 管理システム — マスタデータ投入
--
-- 事業2件・開催枠6件・コース12件。アプリはこれが無いと動かないため、
-- ローカル専用の seed.sql ではなくマイグレーションとして本番にも流す。
--
-- すべて冪等（ON CONFLICT DO NOTHING）。再実行しても既存の値は書き換えない。
-- 料金や時間を変えるときは、このファイルではなく Supabase ダッシュボード
-- （または管理画面）から編集すること。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 事業
--   color_key は DESIGN.md の signature カラートークン名。
--   プログラミング = forest / イラスト = coral（shift_manage_app の mock と揃える）
-- -----------------------------------------------------------------------------
insert into public.businesses (name, color_key, students_per_employee, sort_order)
values
  ('プログラミング教室', 'forest', 3, 1),
  ('イラスト教室',       'coral',  3, 2)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 開催枠（weekday: 0=日 .. 6=土）
--   プログラミング教室: 日曜のみ
--   イラスト教室:       土曜・日曜
--   両教室ともコマ時間は同じ。日曜は2事業が並行開催される。
-- -----------------------------------------------------------------------------
insert into public.business_slots (business_id, weekday, slot_no, start_time, end_time)
select b.id, v.weekday::smallint, v.slot_no::smallint, v.start_time::time, v.end_time::time
from (values
  ('プログラミング教室', 0, 1, '13:00', '14:30'),
  ('プログラミング教室', 0, 2, '15:00', '16:30'),
  ('イラスト教室',       6, 1, '13:00', '14:30'),
  ('イラスト教室',       6, 2, '15:00', '16:30'),
  ('イラスト教室',       0, 1, '13:00', '14:30'),
  ('イラスト教室',       0, 2, '15:00', '16:30')
) as v(business_name, weekday, slot_no, start_time, end_time)
join public.businesses b on b.name = v.business_name
on conflict (business_id, weekday, slot_no) do nothing;

-- -----------------------------------------------------------------------------
-- コース（料金表）
--   学年: 小1=1 .. 小6=6、中1=7 .. 中3=9
--   is_default = 各学年区分の標準コース。
--   ※ 5・6学年・中学生だけ標準が月3回で、月2回にすると安くなる（他学年と逆）。
--     UI で「追加料金」という言い方を固定しないこと。
--   ※ イラスト教室はプログラミング教室より一律 500円安い。
-- -----------------------------------------------------------------------------
insert into public.courses (
  business_id, grade_label, grade_min, grade_max,
  sessions_per_month, monthly_fee, is_default, sort_order
)
select
  b.id, v.grade_label, v.grade_min::smallint, v.grade_max::smallint,
  v.sessions::smallint, v.fee::integer, v.is_default, v.sort_order::smallint
from (values
  -- プログラミング教室
  ('プログラミング教室', '1・2学年',         1, 2, 2,  7500, true,  10),
  ('プログラミング教室', '1・2学年',         1, 2, 3,  9500, false, 11),
  ('プログラミング教室', '3・4学年',         3, 4, 2,  9500, true,  20),
  ('プログラミング教室', '3・4学年',         3, 4, 3, 11500, false, 21),
  ('プログラミング教室', '5・6学年・中学生', 5, 9, 2, 10500, false, 30),
  ('プログラミング教室', '5・6学年・中学生', 5, 9, 3, 12500, true,  31),
  -- イラスト教室
  ('イラスト教室',       '1・2学年',         1, 2, 2,  7000, true,  10),
  ('イラスト教室',       '1・2学年',         1, 2, 3,  9000, false, 11),
  ('イラスト教室',       '3・4学年',         3, 4, 2,  9000, true,  20),
  ('イラスト教室',       '3・4学年',         3, 4, 3, 11000, false, 21),
  ('イラスト教室',       '5・6学年・中学生', 5, 9, 2, 10000, false, 30),
  ('イラスト教室',       '5・6学年・中学生', 5, 9, 3, 12000, true,  31)
) as v(business_name, grade_label, grade_min, grade_max, sessions, fee, is_default, sort_order)
join public.businesses b on b.name = v.business_name
on conflict (business_id, grade_label, sessions_per_month) do nothing;

-- -----------------------------------------------------------------------------
-- 締め切りの繰り返しルール（2行）
--   保護者は前月20日、講師は前月25日。管理者が画面から変更できる。
--   この2行が無いと deadlines が生成されず、どの月も受付が開かない。
-- -----------------------------------------------------------------------------
insert into public.deadline_rules (type, day_of_month, time_of_day)
values ('parent',   20, '23:59'),
       ('employee', 25, '23:59')
on conflict (type) do nothing;

-- 直近2ヶ月ぶんの締め切りを作っておく（以降は pg_cron が毎月1日に生成する）
select public.generate_deadlines(to_char(current_date, 'YYYY-MM'));
select public.generate_deadlines(to_char(current_date + interval '1 month', 'YYYY-MM'));
