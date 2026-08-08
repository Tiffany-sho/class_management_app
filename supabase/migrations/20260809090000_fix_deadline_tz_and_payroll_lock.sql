-- =============================================================================
-- DB テストで見つかった2件の修正
--
-- ★ このファイルはまだ本番に適用していない。適用は `node scripts/sql.mjs <このファイル>`。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 締め切りが意図より18時間うしろにずれる
--
-- 「前月20日 23:59（日本時間）」のつもりで
--     (date_trunc('month', v_prev) + ... + v_rule.time_of_day) at time zone 'Asia/Tokyo'
-- と書いていたが、左辺が **timestamptz に解決される**ため、
-- 「JST の壁時計を UTC に直す」ではなく「UTC の瞬間を JST の壁時計に読み替える」動きになる。
-- 結果、2026-08-20 23:59 JST（= 14:59Z）のはずが 2026-08-21 08:59Z になり、
-- 日本時間では 8月21日 17:59。**締切を過ぎた提出が18時間ぶん通ってしまう。**
--
-- 直し方は左辺を timestamp（タイムゾーンなし）に固定するだけ。
-- `timestamp at time zone 'Asia/Tokyo'` は「その壁時計を JST と解釈した timestamptz」を返す。
--
-- ★ 既に作られている行は動かさない（締めたはずの月の日付が後から変わると、
--   締切を過ぎた提出が通ってしまう ―― 元の設計判断のまま）。
--   ずれたまま運用したくない月は、deadlines の該当行を手で直すこと。
-- -----------------------------------------------------------------------------

create or replace function public.generate_deadlines(p_year_month text default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_target date;
  v_prev   date;
  v_rule   record;
  v_day    smallint;
  v_count  integer := 0;
begin
  -- 引数が無ければ「翌月ぶん」を作る（毎月1日に実行する想定）
  v_target := coalesce(to_date(p_year_month || '-01', 'YYYY-MM-DD'),
                       date_trunc('month', current_date)::date + interval '1 month');
  v_prev   := (v_target - interval '1 month')::date;

  for v_rule in select * from public.deadline_rules where active loop
    -- 月末を超える指定はその月の末日に丸める
    v_day := least(v_rule.day_of_month,
                   extract(day from (date_trunc('month', v_prev)
                                     + interval '1 month - 1 day'))::smallint);

    insert into public.deadlines (year_month, type, deadline_at)
    values (
      to_char(v_target, 'YYYY-MM'),
      v_rule.type,
      /* ★ ::timestamp が要。付けないと timestamptz に解決され、
         「JST に直す」ではなく「JST として読み替える」動きになって9時間ずれる。 */
      ((date_trunc('month', v_prev)::timestamp
        + make_interval(days => v_day - 1)
        + v_rule.time_of_day) at time zone 'Asia/Tokyo')
    )
    on conflict (year_month, type) do nothing;   -- 既存の行は動かさない

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.generate_deadlines(text) is
  '対象月の前月1日に pg_cron から呼ぶ。既存行は上書きしない（管理者が動かした日付を戻さないため）。'
  '時刻は日本時間で解釈する（左辺の ::timestamp を外すとタイムゾーンが逆向きになる）。';

-- -----------------------------------------------------------------------------
-- 2. 確定済みの給与が status を draft に戻す1手で書き換えられる
--
-- 旧: 「確定 → 確定」の更新だけを拒んでいたので、
--     update payrolls set status='draft' ... が通り、そのあと金額を自由に変えられた。
--     確定額は監査のために固定するという前提（ドメインルール11）が崩れる。
--
-- 新: **確定済みの行は一切 UPDATE / DELETE できない。**
--     締め直しが要るときは、管理者が意図して行を消す必要がある ――
--     それも拒むので、ダッシュボードから直接消してから締め直す運用にする
--     （「うっかり」では絶対に動かない状態を優先する）。
-- -----------------------------------------------------------------------------

create or replace function public.lock_confirmed_payroll()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'confirmed' then
      raise exception '確定済みの給与は削除できません（% / %）', old.employee_id, old.year_month;
    end if;
    return old;
  end if;

  /* status を draft に戻す更新も拒む。旧実装は「確定 → 確定」しか見ておらず、
     draft に戻す1手を挟めば金額を書き換えられた。 */
  if old.status = 'confirmed' then
    raise exception '確定済みの給与は変更できません（% / %）。締め直すには行を削除してください',
      old.employee_id, old.year_month;
  end if;
  return new;
end;
$$;
