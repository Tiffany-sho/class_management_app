import type { ReactNode } from 'react';
import { Card, Icon } from '@/components/ui';
import { formatMonthJa, shiftMonth } from '@/lib/date';
import { useSwipeMonth } from '@/hooks/useSwipeMonth';

/**
 * 月送りのカード。左右に払うか ＜＞ で前後の月に移る。
 * スワイプだけにすると操作を見つけられないので、ボタンを必ず出す。
 */
export function MonthHeader({ month, onChange, children }: {
  month: string;
  onChange: (m: string) => void;
  children?: ReactNode;
}) {
  const ref = useSwipeMonth<HTMLDivElement>((d) => onChange(shiftMonth(month, d)));

  return (
    <Card className="mb-md">
      <div ref={ref} className="px-md py-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="前の月"
            onClick={() => onChange(shiftMonth(month, -1))}
            className="grid h-8 w-8 place-items-center rounded-pill border border-hairline text-ink"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <div className="text-[16px] font-medium text-ink tnum">{formatMonthJa(month)}</div>
          <button
            type="button"
            aria-label="次の月"
            onClick={() => onChange(shiftMonth(month, 1))}
            className="grid h-8 w-8 place-items-center rounded-pill border border-hairline text-ink"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
        {children}
      </div>
    </Card>
  );
}
