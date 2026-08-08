-- =============================================================================
-- 既に作られている締切行を、ルールどおりの日本時間に直す（1回きりの後始末）
--
-- generate_deadlines のタイムゾーン取り違えで作られた行が18時間うしろにずれている。
-- 関数は 20260809090000_fix_deadline_tz_and_payroll_lock.sql で直したが、
-- **既存行は on conflict do nothing なので直らない**（「締めたはずの月の日付を
-- 後から動かさない」という元の設計）。ここだけ明示的に上書きする。
--
-- ★ マイグレーションではない。1回流したら役目は終わり。
-- ★ 月末を超える指定の丸めは関数と同じ規則を使う（ここだけ違う計算にしない）。
-- =============================================================================

begin;

select year_month as 対象月, type as 種別,
       to_char(deadline_at at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') as 直す前
  from public.deadlines order by year_month, type;

update public.deadlines d
   set deadline_at =
     ((date_trunc('month', (to_date(d.year_month || '-01', 'YYYY-MM-DD')
                            - interval '1 month')::date)::timestamp
       + make_interval(days =>
           least(r.day_of_month,
                 extract(day from (date_trunc('month',
                   (to_date(d.year_month || '-01', 'YYYY-MM-DD') - interval '1 month')::date)
                   + interval '1 month - 1 day'))::int) - 1)
       + r.time_of_day) at time zone 'Asia/Tokyo')
  from public.deadline_rules r
 where r.type = d.type;

select year_month as 対象月, type as 種別,
       to_char(deadline_at at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') as 直した後,
       case when deadline_at > now() then '受付中' else '締切済み' end as 現状
  from public.deadlines order by year_month, type;

-- ルールと一致していない行が残っていないこと（0件のはず）
select count(*) as ずれが残っている件数
  from public.deadlines d join public.deadline_rules r on r.type = d.type
 where to_char(d.deadline_at at time zone 'Asia/Tokyo', 'DD HH24:MI')
    <> lpad(least(r.day_of_month,
              extract(day from (date_trunc('month',
                (to_date(d.year_month || '-01', 'YYYY-MM-DD') - interval '1 month')::date)
                + interval '1 month - 1 day'))::int)::text, 2, '0')
       || ' ' || to_char(r.time_of_day, 'HH24:MI');

commit;
