import { Icon } from '@/components/ui';
import { formatDayJa, formatMonthJa } from '@/lib/date';
import type { FeeStatus } from '@/types/domain';

interface Props {
  month: string;
  fee: { amount: number; status: FeeStatus; paidDate: string | null; note: string | null } | null;
}

/**
 * その月の月謝の支払い状況。
 *
 * **金額は出さない。** 保護者が毎月ここで確かめたいのは「払ったかどうか」で、
 * いくらかは固定月額なので毎月同じ ―― 変わらない数字を毎回いちばん大きく出すと、
 * 変わる情報（支払い済みかどうか）がその横に埋もれる。
 * 金額を確かめたいときは教室に聞けば分かる（請求書もそちらから出る）。
 *
 * 未払いのときだけ面を赤系にする。**色だけに頼らず「未払い」の文字も必ず併記する。**
 *
 * 月は下の「受講状況」と連動する。**カードに月を書く**のは、月を切り替えたあとに
 * ここへ戻ってきたとき、どの月を見ているのか分からなくなるため。
 */
export function FeeCard({ month, fee }: Props) {
  const unpaid = fee?.status === 'unpaid';
  const label = !fee ? '請求前' : fee.status === 'paid' ? '支払い済み' : '未払い';

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

      {/* 管理者が金額を手で直したときの理由（コース変更の差額など）。
          金額そのものは出さないが、**理由は出す** ―― 説明の無い調整があったこと
          自体を保護者が知らないと、請求書を見たときに問い合わせになる */}
      {fee?.note ? (
        <p className="mt-sm border-l-2 border-hairline pl-sm text-ui-sm leading-relaxed text-body">
          {fee.note}
        </p>
      ) : null}

      <p className="mt-sm text-ui-sm leading-relaxed text-muted">
        {fee
          ? <>月謝は<strong className="text-ink">固定月額</strong>です。お休みされても変わりません。</>
          : '請求されると、ここに支払い状況が出ます。'}
      </p>
    </div>
  );
}
