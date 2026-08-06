import { calendarCells, splitDate, isToday, WEEKDAY_JA } from '@/lib/date';
import type { Business, ScheduleSlot } from '@/types/domain';

export interface DayState {
  /** その日のコマ（事業をまたいで全部） */
  slots: ScheduleSlot[];
  /** 両事業とも確定して初めて「確定した日」。片方でも未確定なら未確定 */
  allConfirmed: boolean;
}

interface Props {
  monthKey: string;
  byDate: Map<string, DayState>;
  businesses: Business[];
  onSelect: (date: string) => void;
  /** 管理者だけ確定/未確定のラベルを出す。保護者・講師には関係のない区別 */
  showStatus?: boolean;
}

/**
 * 月カレンダー。
 *
 * 確定 / 未確定 は背景色だけで区別しない。隣り合う淡い面の色差は
 * ΔE で 2 を切ると人間には見分けられないので、左端の色帯と文字ラベルを併用する。
 */
export function MonthCalendar({ monthKey, byDate, businesses, onSelect, showStatus = false }: Props) {
  const cells = calendarCells(monthKey);
  const bizName = new Map(businesses.map((b) => [b.id, b]));

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-card">
      <div className="grid grid-cols-7 border-b border-hairline">
        {WEEKDAY_JA.map((w, i) => (
          <div
            key={w}
            className={`px-xs py-[6px] text-left text-[11px] font-medium
              ${i === 0 ? 'text-coral' : i === 6 ? 'text-info' : 'text-muted'}`}
          >
            {w}
          </div>
        ))}
      </div>

      {[0, 1, 2, 3, 4, 5].map((week) => (
        <div key={week} className="grid grid-cols-7 border-b border-hairline last:border-0">
          {cells.slice(week * 7, week * 7 + 7).map((date, i) => {
            if (!date) {
              return <div key={`${week}-${i}`} className="min-h-[92px] border-r border-hairline bg-surface-soft last:border-0" />;
            }
            const state = byDate.get(date);
            const has = Boolean(state && state.slots.length > 0);
            const [, , day] = splitDate(date);
            const today = isToday(date);

            const tone = !has
              ? ''
              : state!.allConfirmed
                ? 'bg-state-confirmed shadow-[inset_4px_0_0_theme(colors.forest)]'
                : 'bg-state-pending shadow-[inset_4px_0_0_theme(colors.coral)]';

            return (
              <button
                key={date}
                type="button"
                disabled={!has}
                onClick={() => onSelect(date)}
                className={`flex min-h-[92px] flex-col gap-[3px] border-r border-hairline p-[6px]
                  text-left last:border-0 ${tone}
                  ${has ? 'cursor-pointer hover:brightness-[.98]' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-[4px]">
                  <span
                    className={`text-[12px] tnum ${today
                      ? 'grid h-[19px] w-[19px] place-items-center rounded-pill bg-primary text-on-primary'
                      : 'text-muted'}`}
                  >
                    {day}
                  </span>
                  {showStatus && has ? (
                    <span
                      className={`ml-auto text-[9px] ${state!.allConfirmed ? 'text-forest' : 'text-coral'}`}
                    >
                      {state!.allConfirmed ? '✓ 確定' : '未確定'}
                    </span>
                  ) : null}
                </div>

                {/* 事業ごとのコマ数をチップで出す。未確定は破線 */}
                {groupByBusiness(state?.slots ?? []).map(([businessId, list]) => {
                  const b = bizName.get(businessId);
                  const confirmed = list.every((s) => s.status === 'confirmed');
                  const isProg = b?.colorKey === 'forest';
                  return (
                    <span
                      key={businessId}
                      className={`truncate rounded-sm px-[5px] py-[2px] text-[10px] leading-tight
                        ${confirmed
                          ? isProg ? 'bg-forest text-on-dark' : 'bg-coral text-on-dark'
                          : `border border-dashed ${isProg ? 'border-forest text-forest' : 'border-coral text-coral'}`}`}
                    >
                      {b?.name?.replace('教室', '') ?? '—'} {list.length}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function groupByBusiness(slots: ScheduleSlot[]): [string, ScheduleSlot[]][] {
  const m = new Map<string, ScheduleSlot[]>();
  for (const s of slots) {
    const list = m.get(s.businessId) ?? [];
    list.push(s);
    m.set(s.businessId, list);
  }
  return [...m.entries()];
}

/** 凡例。色の意味は必ず書く（色だけでは伝わらない） */
export function CalendarLegend({ businesses }: { businesses: Business[] }) {
  return (
    <div className="flex flex-wrap items-center gap-md text-[11px] text-muted">
      {businesses.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-[5px]">
          <i className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`} />
          {b.name}
        </span>
      ))}
      <span className="inline-flex items-center gap-[5px]">
        <i className="h-[11px] w-[14px] rounded-sm border border-dashed border-border-strong" />
        未確定のコマ
      </span>
      <span className="inline-flex items-center gap-[5px]">
        <i className="h-[11px] w-[14px] rounded-sm bg-state-confirmed shadow-[inset_4px_0_0_theme(colors.forest)]" />
        確定した日
      </span>
      <span className="inline-flex items-center gap-[5px]">
        <i className="h-[11px] w-[14px] rounded-sm bg-state-pending shadow-[inset_4px_0_0_theme(colors.coral)]" />
        未確定を含む日
      </span>
    </div>
  );
}
