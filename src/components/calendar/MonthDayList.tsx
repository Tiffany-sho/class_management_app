import { Icon } from '@/components/ui';
import { formatDayJa, formatTimeRange } from '@/lib/date';
import type { CellMode } from './DayCellChips';
import type { Business, ScheduleSlot } from '@/types/domain';
import type { DayState } from './MonthCalendar';

interface Props {
  dates: string[];
  byDate: Map<string, DayState>;
  businesses: Business[];
  onSelect: (date: string) => void;
  showStatus: boolean;
  cell: CellMode;
}

/**
 * 狭い画面のカレンダー。**7列の升目をやめて、コマのある日だけを縦に並べる。**
 *
 * 教室が開くのは土日だけなので、月〜金の5列は1年じゅう空のまま画面幅の
 * 7分の5を占める。残った2列は 375px の端末で1マス 53px にしかならず、
 * 教室名も「コマ」の字も入らないので、**数字が1つ置いてあるだけの升目**になる。
 * それは日付の並びを見せているのであって、中身は何も伝えていない。
 *
 * 1日1行にすれば横幅がまるごと使えるので、教室名も件数も状態も**言葉のまま**入る。
 * 升目は `sm`（640px）以上でだけ出す。
 */
export function MonthDayList({
  dates, byDate, businesses, onSelect, showStatus, cell,
}: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const active = dates.filter((d) => (byDate.get(d)?.slots.length ?? 0) > 0);

  if (active.length === 0) {
    return (
      <div className="rounded-md border border-hairline bg-canvas px-md py-lg text-center
        text-ui-base text-muted shadow-card">
        この月に開催日はありません。
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-card">
      {active.map((date) => {
        const state = byDate.get(date)!;
        return (
          <li key={date} className="border-b border-hairline last:border-0">
            <button
              type="button"
              onClick={() => onSelect(date)}
              className={`flex w-full items-center gap-sm px-md py-sm text-left
                hover:bg-surface-soft
                ${state.allConfirmed
                  ? 'shadow-[inset_4px_0_0_theme(colors.forest)]'
                  : 'shadow-[inset_4px_0_0_theme(colors.coral)]'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="whitespace-nowrap text-ui-md text-ink">
                    {formatDayJa(date)}
                  </span>
                  {showStatus ? (
                    <span
                      className={`flex items-center gap-[2px] whitespace-nowrap text-ui-xs
                        ${state.allConfirmed ? 'text-forest' : 'text-coral'}`}
                    >
                      {state.allConfirmed ? <Icon name="check" size={12} /> : null}
                      {state.allConfirmed ? '確定' : '未確定'}
                    </span>
                  ) : null}
                </div>

                <div className="mt-[3px] flex flex-col gap-[2px]">
                  {rowsOf(state.slots, cell, bizMap).map((r) => (
                    <span
                      key={r.key}
                      className="flex items-center gap-[6px] text-ui-sm text-muted"
                    >
                      <span
                        aria-hidden
                        className={`h-[9px] w-[9px] shrink-0 rounded-pill
                          ${bizMap.get(r.businessId)?.colorKey === 'forest'
                            ? 'bg-forest' : 'bg-coral'}`}
                      />
                      {r.text}
                    </span>
                  ))}
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 1日の中に出す行。
 * 管理者は教室ごとに1行（何コマ動くか）、講師はコマごとに1行（何時に何人来るか）。
 */
function rowsOf(slots: ScheduleSlot[], cell: CellMode, bizMap: Map<string, Business>) {
  if (cell.kind === 'assignment') {
    return [...slots].sort((a, b) => a.slotNo - b.slotNo).map((s) => ({
      key: s.id,
      businessId: s.businessId,
      text: `${formatTimeRange(s.startTime, s.endTime)} ・ 生徒${s.students.length}名`,
    }));
  }
  const byBiz = new Map<string, ScheduleSlot[]>();
  for (const s of slots) byBiz.set(s.businessId, [...(byBiz.get(s.businessId) ?? []), s]);
  return [...byBiz.entries()].map(([businessId, list]) => ({
    key: businessId,
    businessId,
    text: `${bizMap.get(businessId)?.name ?? ''} ${list.length}コマ`,
  }));
}
