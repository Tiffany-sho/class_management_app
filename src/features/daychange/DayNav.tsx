import { Button, Icon } from '@/components/ui';
import { formatDayJa, isToday, shiftDay, todayIso } from '@/lib/date';

/**
 * 日送り。
 *
 * この画面だけ月ではなく**日で動かす**。急な欠席・欠勤はその日のことなので、
 * 月から目的の日を探させると、直したい回にたどり着くまでが遠い。
 */
export function DayNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <div className="flex items-center gap-xs">
      <button
        type="button"
        aria-label="前の日"
        onClick={() => onChange(shiftDay(value, -1))}
        className="grid h-8 w-8 place-items-center rounded-pill border border-hairline bg-canvas
          text-ink hover:border-border-strong"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <div className="min-w-[140px] text-center text-ui-lg font-medium text-ink tnum">
        {formatDayJa(value)}
      </div>
      <button
        type="button"
        aria-label="次の日"
        onClick={() => onChange(shiftDay(value, 1))}
        className="grid h-8 w-8 place-items-center rounded-pill border border-hairline bg-canvas
          text-ink hover:border-border-strong"
      >
        <Icon name="chevron-right" size={16} />
      </button>
      <Button size="sm" disabled={isToday(value)} onClick={() => onChange(todayIso())}>
        今日
      </Button>
    </div>
  );
}
