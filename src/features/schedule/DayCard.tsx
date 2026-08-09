import { Icon } from '@/components/ui';
import { splitDate, weekdayOf, WEEKDAY_JA } from '@/lib/date';
import type { Business } from '@/types/domain';

export interface DaySummary {
  date: string;
  /** その日のコマ数（事業をまたいで全部） */
  total: number;
  confirmed: number;
  /** 生徒はいるのに担当が決まっていないコマ。**これが一番先に直すべきもの** */
  noEmployee: number;
  overCapacity: number;
  /** 事業ごとのコマ数。日曜は2教室が並行開催されるので、事業を潰して数えない */
  byBusiness: { businessId: string; count: number }[];
}

interface Props {
  day: DaySummary;
  businesses: Business[];
  selected: boolean;
  onSelect: () => void;
}

/**
 * 1日ぶんのカード。押すとその日のコマだけを下に出す。
 *
 * **カードだけ見て「どの日を直すか」が決まるようにする。** 開いてみないと
 * 分からないと、月の全部の日を順に開くことになる。そのため
 * 担当未定・定員超過の件数をカードの上に出している。
 */
export function DayCard({ day, businesses, selected, onSelect }: Props) {
  const [, , d] = splitDate(day.date);
  const w = weekdayOf(day.date);
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const needsWork = day.noEmployee > 0 || day.overCapacity > 0;
  const allConfirmed = day.total > 0 && day.confirmed === day.total;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-md border p-sm text-left transition-colors
        ${selected
          ? 'border-primary bg-surface-soft shadow-card'
          : 'border-hairline bg-canvas hover:border-border-strong'}`}
    >
      <div className="flex items-baseline gap-[4px]">
        <span className="text-ui-xl font-medium text-ink tnum">{d}</span>
        <span className={`whitespace-nowrap text-ui-sm
          ${w === 0 ? 'text-coral' : w === 6 ? 'text-info' : 'text-muted'}`}>
          日（{WEEKDAY_JA[w]}）
        </span>
        <span className="flex-1" />
        {allConfirmed ? <Icon name="check" size={14} className="text-forest" /> : null}
      </div>

      <div className="mt-xs flex flex-wrap gap-[3px]">
        {day.byBusiness.map(({ businessId, count }) => {
          const b = bizMap.get(businessId);
          return (
            <span
              key={businessId}
              className={`whitespace-nowrap rounded-sm px-[5px] py-[1px] text-ui-2xs
                leading-tight text-on-dark
                ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
            >
              {b?.name?.replace('教室', '') ?? '—'} {count}
            </span>
          );
        })}
      </div>

      <div className="mt-xs text-ui-xs tnum">
        {needsWork ? (
          <span className="text-coral">
            {day.noEmployee > 0 ? `担当未定 ${day.noEmployee}` : ''}
            {day.noEmployee > 0 && day.overCapacity > 0 ? ' / ' : ''}
            {day.overCapacity > 0 ? `定員超過 ${day.overCapacity}` : ''}
          </span>
        ) : allConfirmed ? (
          <span className="text-forest">確定済み</span>
        ) : (
          <span className="text-muted">未確定 {day.total - day.confirmed}</span>
        )}
      </div>
    </button>
  );
}
