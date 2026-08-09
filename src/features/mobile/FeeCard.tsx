import { Icon } from '@/components/ui';
import { isAdjusted } from '@/lib/queries';
import { formatDayJa, formatMonthJa } from '@/lib/date';
import type { FeeStatus } from '@/types/domain';

interface Props {
  month: string;
  fee: {
    amount: number;
    baseAmount: number;
    status: FeeStatus;
    paidDate: string | null;
    note: string | null;
  } | null;
}

/**
 * その月の月謝の支払い状況。
 *
 * **金額は出さない。** 保護者が毎月ここで確かめたいのは「払ったかどうか」で、
 * いくらかは固定月額なので毎月同じ ―― 変わらない数字を毎回いちばん大きく出すと、
 * 変わる情報（支払い済みかどうか）がその横に埋もれる。
 * 金額を確かめたいときは教室に聞けば分かる（請求書もそちらから出る）。
 *
 * **ただし、その月だけ額が動いたときは必ず知らせる。** 金額を出さない方針のままだと、
 * 管理者が調整した月に保護者が何も気づけず、請求書が届いてから問い合わせになる。
 * 動いた月にだけ「金額を見直しました」と出す ―― **毎月出すと意味が消える**ので、
 * 判定は発行時の額との差（`isAdjusted`）で行う。
 *
 * **増えたか減ったかまでは書く。** 「見直しました」だけでは、慌てて確かめるべきか
 * どうかが分からない。金額そのものは出さない方針を変えないまま、そこだけ伝える。
 *
 * 未払いのときだけ面を赤系にする。**色だけに頼らず「未払い」の文字も必ず併記する。**
 *
 * 月は下の「受講状況」と連動する。**カードに月を書く**のは、月を切り替えたあとに
 * ここへ戻ってきたとき、どの月を見ているのか分からなくなるため。
 */
export function FeeCard({ month, fee }: Props) {
  const unpaid = fee?.status === 'unpaid';
  const label = !fee ? '請求前' : fee.status === 'paid' ? '支払い済み' : '未払い';
  const adjusted = fee ? isAdjusted(fee) : false;
  const up = fee ? fee.amount > fee.baseAmount : false;

  return (
    <div
      className={`mb-md rounded-md border p-lg shadow-card
        ${unpaid ? 'border-coral bg-illust-tint' : 'border-hairline bg-canvas'}`}
    >
      <div className="text-ui-xs tracking-[0.06em] text-muted">
        {formatMonthJa(month)}の月謝
      </div>

      <div className="mt-[6px] flex items-center gap-xs">
        <Icon
          name={unpaid ? 'warning' : fee ? 'check-circle' : 'wallet'}
          size={20}
          className={unpaid ? 'text-coral' : fee ? 'text-success' : 'text-muted'}
        />
        <span
          className={`text-ui-2xl font-medium leading-[1.2]
            ${unpaid ? 'text-coral' : 'text-ink'}`}
        >
          {label}
        </span>
      </div>

      {fee?.paidDate ? (
        <div className="mt-[4px] text-ui-base text-muted tnum">
          {formatDayJa(fee.paidDate)} 入金
        </div>
      ) : null}

      {/* 額が動いた月だけ出す。管理者が理由をメモに残していればそれも続けて出す
          （メモは入金記録のシートから入る → FeePaymentSheet）。
          **メモが空でも「見直した」ことだけは出す** ―― 理由が無いことを理由に
          黙ると、いちばん問い合わせになる形（金額だけ違う請求書）に戻る */}
      {adjusted ? (
        <div className="mt-md rounded-sm border border-hairline bg-surface-soft px-sm py-xs">
          <div className="flex items-center gap-[6px] text-ui-sm font-medium text-ink">
            <Icon name="info" size={15} className="shrink-0 text-muted" />
            この月は金額を見直しました（{up ? '増額' : '減額'}）
          </div>
          <p className="mt-[3px] text-ui-sm leading-relaxed text-body">
            {fee?.note ?? 'くわしくは教室にお問い合わせください。'}
          </p>
        </div>
      ) : fee?.note ? (
        <p className="mt-sm border-l-2 border-hairline pl-sm text-ui-sm leading-relaxed text-body">
          {fee.note}
        </p>
      ) : null}

      <p className="mt-sm text-ui-sm leading-relaxed text-muted">
        {!fee
          ? '請求されると、ここに支払い状況が出ます。'
          : adjusted
            ? <>ふだんの月謝は<strong className="text-ink">固定月額</strong>です。この月だけ金額が違います。</>
            : <>月謝は<strong className="text-ink">固定月額</strong>です。お休みされても変わりません。</>}
      </p>
    </div>
  );
}
