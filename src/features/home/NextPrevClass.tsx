import { Button, Card, SectionLabel, Badge } from '@/components/ui';
import { formatDayJa, formatTimeRange, isPast, toISODate } from '@/lib/date';
import { ATTENDANCE_LABEL } from '@/lib/format';
import type { Business, ScheduleSlot } from '@/types/domain';

interface Props {
  slots: ScheduleSlot[];
  businesses: Business[];
  onOpen: (date: string) => void;
}

/**
 * 次回・前回の教室。
 * 同じ日に複数コマ（日曜は2教室が並行）があれば全部出す。
 * 前回は実施済みなので出席の内訳と記録の件数を添える。
 * 次回はまだ実施していないので出席は出さない。
 */
export function NextPrevClass({ slots, businesses, onOpen }: Props) {
  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const dates = [...new Set(slots.map((s) => s.sessionDate))].sort();
  const nextDate = dates.find((d) => d >= todayISO) ?? null;
  const prevDate = [...dates].reverse().find((d) => isPast(d)) ?? null;

  return (
    <>
      <SectionLabel>次回の教室</SectionLabel>
      <div className="mb-lg">
        {nextDate ? (
          <DayCard
            date={nextDate}
            slots={slots.filter((s) => s.sessionDate === nextDate)}
            businesses={businesses}
            showAttendance={false}
            onOpen={onOpen}
          />
        ) : (
          <Card><p className="p-md text-[13px] text-muted">この月はもう開催がありません。</p></Card>
        )}
      </div>

      <SectionLabel>前回の教室</SectionLabel>
      {prevDate ? (
        <DayCard
          date={prevDate}
          slots={slots.filter((s) => s.sessionDate === prevDate)}
          businesses={businesses}
          showAttendance
          onOpen={onOpen}
        />
      ) : (
        <Card><p className="p-md text-[13px] text-muted">この月はまだ開催がありません。</p></Card>
      )}
    </>
  );
}

function DayCard({
  date, slots, businesses, showAttendance, onOpen,
}: {
  date: string;
  slots: ScheduleSlot[];
  businesses: Business[];
  showAttendance: boolean;
  onOpen: (date: string) => void;
}) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-sm border-b border-hairline px-md py-sm">
        <div className="text-[15px] text-ink">{formatDayJa(date)}</div>
        <div className="text-[12px] text-muted">{slots.length}コマ</div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => onOpen(date)}>詳細を見る</Button>
      </div>

      {slots.map((s) => {
        const b = bizMap.get(s.businessId);
        const present = s.students.filter((x) => x.attendanceStatus === 'present').length;
        const late = s.students.filter((x) => x.attendanceStatus === 'late').length;
        const absent = s.students.filter((x) => x.attendanceStatus === 'absent').length;
        const noted = s.students.filter((x) => x.note).length;

        return (
          <div key={s.id} className="flex flex-wrap items-center gap-sm border-b border-hairline px-md py-sm last:border-0">
            <span
              aria-hidden
              className={`h-[9px] w-[9px] shrink-0 rounded-pill ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink">
                {b?.name ?? '—'} 第{s.slotNo}コマ
              </div>
              <div className="mt-[2px] text-[12px] text-muted tnum">
                {formatTimeRange(s.startTime, s.endTime)} ・ 生徒{s.students.length}名 ・ 担当{' '}
                {s.employees.length ? s.employees.map((e) => e.name).join('・') : '未定'}
              </div>
              {showAttendance ? (
                <div className="mt-xs flex flex-wrap items-center gap-xs">
                  <Badge tone="success">{ATTENDANCE_LABEL.present} {present}</Badge>
                  <Badge tone="neutral">{ATTENDANCE_LABEL.late} {late}</Badge>
                  <Badge tone="danger">{ATTENDANCE_LABEL.absent} {absent}</Badge>
                  <span className="text-[12px] text-muted">記録 {noted}/{s.students.length}</span>
                </div>
              ) : null}
            </div>
            {s.status === 'confirmed'
              ? <Badge tone="success">確定</Badge>
              : <Badge tone="neutral">未確定</Badge>}
          </div>
        );
      })}
    </Card>
  );
}
