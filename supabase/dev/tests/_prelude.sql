-- =============================================================================
-- DB テストの共通部品。**各テストファイルの先頭に貼って使う**
-- （SQL の \i が使えないので、ファイルごとに同じものを持たせている）
--
-- ★ すべて begin 〜 rollback の中で走らせる。データは1行も残さない。
-- ★ 「弾かれること」の確認は **理由まで一致して初めて OK** にする。
--   別の理由（NOT NULL 違反など）で失敗したのを「弾けた」と読むと、
--   制約が外れていても気づけない。
-- =============================================================================

create temp table t_result(no text, item text, verdict text, detail text);

-- 弾かれるべきもの。want に期待するエラーの一部を渡す
create function pg_temp.ng(no text, item text, stmt text, want text) returns void
language plpgsql as $f$
begin
  execute stmt;
  insert into pg_temp.t_result values (no, item, 'NG', '★通ってしまった');
exception when others then
  insert into pg_temp.t_result values (no, item,
    case when sqlerrm like '%' || want || '%' then 'OK' else 'NG' end,
    case when sqlerrm like '%' || want || '%' then '弾いた' else '★別の理由で失敗: ' end
      || substr(sqlerrm, 1, 60));
end $f$;

-- 通るべきもの。通ったら取り消す（後のテストに影響させない）
create function pg_temp.ok(no text, item text, stmt text) returns void
language plpgsql as $f$
begin
  execute stmt;
  raise exception using errcode = 'ZZ001', message = 'undo';
exception
  when sqlstate 'ZZ001' then
    insert into pg_temp.t_result values (no, item, 'OK', '通った（取り消し済み）');
  when others then
    insert into pg_temp.t_result values (no, item, 'NG', '★弾かれた: ' || substr(sqlerrm, 1, 60));
end $f$;

-- 値の一致
create function pg_temp.eq(no text, item text, actual text, expected text) returns void
language plpgsql as $f$
begin
  insert into pg_temp.t_result values (no, item,
    case when actual is not distinct from expected then 'OK' else 'NG' end,
    case when actual is not distinct from expected
         then coalesce(actual, '(null)')
         else '★' || coalesce(actual, '(null)') || ' ≠ ' || coalesce(expected, '(null)') end);
end $f$;

create function pg_temp.report() returns table(no text, item text, verdict text, detail text)
language sql as $f$
  select * from pg_temp.t_result order by no;
$f$;
