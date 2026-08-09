-- =============================================================================
-- 月謝に「発行時の額」を持たせる
--
-- 保護者の画面は金額そのものを出さない（固定月額なので、毎月同じ数字をいちばん
-- 大きく出すと、変わる情報＝支払い状況がその横に埋もれる）。ところがその方針の
-- ままだと、**管理者が金額を調整した月に保護者が何も気づけない**。請求書が届いて
-- から「なぜ違うのか」と問い合わせることになる。
--
-- ところが今は「調整されたかどうか」を判定する材料が無い。amount は発行時に
-- コースの月額をコピーした値で、そのあと管理者が上書きするので、**上書きされたか
-- どうかが値そのものからは分からない**。
--
-- courses.monthly_fee と突き合わせるのは誤り ―― 料金改定をした瞬間、一度も
-- 触っていない過去の全月が「調整された」ことになってしまう
-- （fees が courses を join しない理由と同じ。schema.sql の amount のコメント）。
--
-- そこで**発行時の額を別の列に取っておく**。この列は以後動かさない。
--   調整あり = amount <> base_amount
-- =============================================================================

alter table public.fees
  add column base_amount integer check (base_amount >= 0);

-- 既存行は「調整されたのかどうか」が分からない。分からないものは**調整なしとして
-- 埋める**。逆にすると、一度も触っていない月にまで「金額を見直しました」と保護者に
-- 出てしまう。**証明できないことを画面に書かない。**
update public.fees set base_amount = amount where base_amount is null;

alter table public.fees alter column base_amount set not null;

comment on column public.fees.base_amount is
  '発行時の額（courses.monthly_fee のコピー）。以後変えない。amount と違えば管理者が調整した月。';

-- -----------------------------------------------------------------------------
-- 発行時に base_amount も入れる。
-- **既存行を書き換えない**ところは変えない（手で直した金額を守るため）。
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

  insert into public.fees (student_id, year_month, amount, base_amount, status)
  select s.id, v_month, c.monthly_fee, c.monthly_fee, 'unpaid'
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
