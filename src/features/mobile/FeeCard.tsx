import { Badge } from '@/components/ui';
import { formatDayJa, formatMonthJa } from '@/lib/date';
import { FEE_LABEL, yen } from '@/lib/format';
import type { FeeStatus } from '@/types/domain';

interface Props {
  month: string;
  fee: { amount: number; status: FeeStatus; paidDate: string | null; note: string | null } | null;
}

/**
 * その月の月謝。
 *
 * **保護者がこのアプリで一番確かめたいのは金額と支払い状況**なので、
 * 受講状況の見出し行に小さなバッジで添えるのをやめ、独立したカードにして
 * 金額をそのまま大きく出す。未払いのときだけ面を赤系にする（色だけに頼らず
 * 「未払い」の文字も必ず併記する）。
 *
 * 月は下の「受講状況」と連動する。**カードに月を書く**のは、月を切り替えたあとに
 * ここへ戻ってきたとき、どの月の金額を見ているのか分からなくなるため。
 *
 * `note` は管理者がその月だけ金額を手で調整したときの理由（コース変更の差額など、
 * ドメインルール10）。**入っていれば必ず出す** ―― 理由の分からない増減が
 * そのまま請求されると、問い合わせになる。
 */
export function FeeCard({ month, fee }: Props) {
  const unpaid = fee?.status === 'unpaid';

  return (
    <div
      className={`mb-md rounded-md border p-lg shadow-card
        ${unpaid ? 'border-coral bg-illust-tint' : 'border-hairline bg-canvas'}`}
    >
      <div className="flex items-center gap-xs">
        <span className="text-[11px] tracking-[0.06em] text-muted">
          {formatMonthJa(month)}の月謝
        </span>
        <span className="flex-1" />
        {!fee ? (
          <Badge tone="neutral">請求前</Badge>
        ) : (
          <Badge tone={fee.status === 'paid' ? 'success' : 'danger'}>{FEE_LABEL[fee.status]}</Badge>
        )}
      </div>

      {!fee ? (
        <>
          <div className="mt-[6px] text-[15px] text-ink">まだ請求されていません。</div>
          <p className="mt-xs text-[12px] leading-relaxed text-muted">
            請求されると、ここに金額が出ます。
          </p>
        </>
      ) : (
        <>
          <div className="mt-[4px] text-[30px] font-medium leading-[1.15] text-ink tnum">
            {yen(fee.amount)}
          </div>
          <div className="mt-[4px] text-[13px] text-muted tnum">
            {fee.paidDate ? `${formatDayJa(fee.paidDate)} 入金` : 'お支払いをお待ちしています'}
          </div>
          {fee.note ? (
            <p className="mt-sm rounded-sm border-l-2 border-hairline pl-sm text-[12px]
              leading-relaxed text-body">
              {fee.note}
            </p>
          ) : null}
          <p className="mt-sm text-[12px] leading-relaxed text-muted">
            <strong className="text-ink">固定月額</strong>です。
            お休みされても金額は変わりません。
          </p>
        </>
      )}
    </div>
  );
}
