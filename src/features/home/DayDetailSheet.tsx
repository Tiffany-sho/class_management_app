import { Badge, Button, Sheet } from '@/components/ui';
import { formatDayJa, formatTimeRange, isPast } from '@/lib/date';
import { ATTENDANCE_LABEL, attendanceTone } from '@/lib/format';
import type { Business, ScheduleSlot } from '@/types/domain';

interface Props {
  date: string | null;
  slots: ScheduleSlot[];
  businesses: Business[];
  onClose: () => void;
}

/**
 * その日の詳細。
 * 実施済みの日は出欠と授業記録を出す。まだの日は割り当てだけ。
 * 出欠と記録は同じ行に出す（別々に並べると突き合わせることになる）。
 */
export function DayDetailSheet({ date, slots, businesses, onClose }: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const past = date ? isPast(date) : false;

  return (
    <Sheet
      open={Boolean(date)}
      title={date ? formatDayJa(date) : ''}
      subtitle={`${slots.length}コマ ・ ${past ? '実施済み' : 'これから'}`}
      onClose={onClose}
      footer={<Button block onClick={onClose}>閉じる</Button>}
    >
      {slots.map((s) => {
        const b = bizMap.get(s.businessId);
        const over = s.isOverCapacity;
        const noEmployee = s.employees.length === 0;

        return (
          <section key={s.id} className="mb-lg rounded-md border border-hairline">
            <header className="flex flex-wrap items-center gap-xs border-b border-hairline px-md py-sm">
              <span
                aria-hidden
                className={`h-[9px] w-[9px] rounded-pill ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              <span className="text-[14px] text-ink">{b?.name ?? '—'} 第{s.slotNo}コマ</span>
              <span className="text-[12px] text-muted tnum">
                {formatTimeRange(s.startTime, s.endTime)}
              </span>
              <span className="flex-1" />
              {/* 担当未定を定員超過より先に出す。0人のときの本当の問題は超過ではない */}
              {noEmployee ? (
                <Badge tone="danger">担当未定</Badge>
              ) : over ? (
                <Badge tone="danger">定員超過</Badge>
              ) : s.status === 'confirmed' ? (
                <Badge tone="success">確定</Badge>
              ) : (
                <Badge tone="neutral">未確定</Badge>
              )}
            </header>

            <div className="px-md py-sm">
              <div className="mb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
                担当講師（{s.employees.length}名 ／ 定員 {s.capacity}名）
              </div>
              <div className="mb-md flex flex-wrap gap-xs">
                {s.employees.length ? (
                  s.employees.map((e) => (
                    <span key={e.id} className="rounded-pill bg-surface-dark px-sm py-[3px] text-[12px] text-on-dark">
                      {e.name}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-coral">担当が決まっていません</span>
                )}
              </div>

              <div className="mb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
                受講生徒（{s.students.length}名）
              </div>
              {s.students.length === 0 ? (
                <p className="text-[13px] text-muted">受講生徒がまだ割り当てられていません。</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {s.students.map((st) => (
                    <li key={st.studentId} className="rounded-md border border-hairline px-sm py-xs">
                      <div className="flex items-center gap-xs">
                        <span className="flex-1 text-[13px] text-ink">{st.studentName}</span>
                        {past ? (
                          st.attendanceStatus ? (
                            <Badge tone={attendanceTone(st.attendanceStatus)}>
                              {ATTENDANCE_LABEL[st.attendanceStatus]}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">未マーク</Badge>
                          )
                        ) : null}
                      </div>
                      {past ? (
                        <div className="mt-[5px] text-[12px] leading-relaxed text-muted">
                          {st.attendanceStatus === 'absent'
                            ? '欠席のため授業記録はありません。'
                            : st.note
                              ? <>📝 {st.note}{st.notedByName ? `（記録: ${st.notedByName}）` : ''}</>
                              : '授業記録はまだ記入されていません。'}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}
