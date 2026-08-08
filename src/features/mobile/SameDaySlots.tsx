import { NameLink } from '@/components/ui';
import { formatTimeRange } from '@/lib/date';
import type { DaySlot } from './useEmployeeDay';

interface Props {
  slots: DaySlot[];
  meId: string | null;
  onOpenStaff: (employeeId: string) => void;
}

/**
 * 同じ日の自分の担当（直近のコマ以外）。
 *
 * **担当していない教室のコマは出さない。** 日曜は2教室が並行開催されるので、
 * 絞らないと自分が入らないコマまで並び、どれが自分のぶんか読めなくなる。
 *
 * 一緒に入る講師の名前は押せる。当日の段取りで「誰と組むか」を確かめたくなる。
 */
export function SameDaySlots({ slots, meId, onOpenStaff }: Props) {
  if (slots.length === 0) {
    return <p className="text-[13px] text-muted">この日の担当はこのコマだけです。</p>;
  }

  return (
    <ul className="flex flex-col gap-sm">
      {slots.map(({ slot, business }) => {
        const mates = slot.employees.filter((e) => e.id !== meId);
        return (
          <li key={slot.id} className="flex items-start gap-sm">
            <span
              aria-hidden
              className={`mt-[7px] h-[9px] w-[9px] shrink-0 rounded-pill
                ${business?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink">
                {business?.name ?? '—'} 第{slot.slotNo}コマ
              </div>
              <div className="mt-[2px] flex flex-wrap items-center gap-x-xs text-[12px] text-muted">
                <span className="tnum">{formatTimeRange(slot.startTime, slot.endTime)}</span>
                <span>・ 生徒{slot.students.length}名</span>
                {mates.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-[2px]">
                    ・
                    {mates.map((m) => (
                      <NameLink key={m.id} tone="muted" onClick={() => onOpenStaff(m.id)}>
                        {m.name}
                      </NameLink>
                    ))}
                    <span>と{mates.length + 1}名体制</span>
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
