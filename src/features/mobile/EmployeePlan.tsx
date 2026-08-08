import { useMemo, useState } from 'react';
import { Card, Empty, Loading, ErrorNote, Note, SectionLabel } from '@/components/ui';
import { MonthCalendar, CalendarLegend, type DayState } from '@/components/calendar/MonthCalendar';
import { DayDetailSheet } from '@/components/calendar/DayDetailSheet';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchScheduleMonth } from '@/lib/queries';
import { currentMonthKey, formatDayJa, formatMonthJa, formatTimeRange, isPast } from '@/lib/date';
import { MonthHeader } from './MonthHeader';

/**
 * 講師の予定。
 *
 * **月カレンダーが主で、一覧はその下**（モックと同じ構成）。日曜は2教室が
 * 並行開催されるので、日単位で見ないと自分がどちらに入っているか分からない。
 *
 * 出るのは**自分が担当する確定済みのコマだけ**。担当していない教室のコマも、
 * 未確定のコマも RLS が返さないので、ここで絞り込みを書いていない。
 */
export function EmployeePlan() {
  const [month, setMonth] = useState(currentMonthKey());
  const [day, setDay] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [businesses, slots] = await Promise.all([fetchBusinesses(), fetchScheduleMonth(month)]);
    return { businesses, slots };
  }, [month]);

  const byDate = useMemo(() => {
    const m = new Map<string, DayState>();
    for (const s of state.data?.slots ?? []) {
      const cur = m.get(s.sessionDate) ?? { slots: [], allConfirmed: true };
      cur.slots.push(s);
      cur.allConfirmed = cur.allConfirmed && s.status === 'confirmed';
      m.set(s.sessionDate, cur);
    }
    return m;
  }, [state.data]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
  const sorted = [...d.slots].sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo);

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      <MonthCalendar
        monthKey={month}
        byDate={byDate}
        businesses={d.businesses}
        onSelect={setDay}
      />

      <div className="mt-sm">
        <CalendarLegend businesses={d.businesses} showStatus={false} />
      </div>

      <p className="mb-lg mt-sm text-[12px] leading-relaxed text-muted">
        <strong className="text-ink">自分が担当するコマだけ</strong>が出ます。
        担当していない教室のコマは出ません。日付を押すと、その日の生徒と出欠が見られます。
      </p>

      <SectionLabel>{formatMonthJa(month)}の確定した勤務</SectionLabel>
      <Card className="mb-md">
        {sorted.length === 0 ? (
          <Empty
            title="この月に担当しているコマはありません。"
            hint="教室がスケジュールを確定すると、ここに出ます。"
          />
        ) : (
          <ul>
            {sorted.map((s) => {
              const b = bizMap.get(s.businessId);
              const others = s.employees.filter((e) => e.name);
              return (
                <li key={s.id} className="border-b border-hairline px-md py-sm last:border-0">
                  <div className="flex flex-wrap items-center gap-xs">
                    <span
                      aria-hidden
                      className={`h-[9px] w-[9px] rounded-pill ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                    />
                    <span className="text-[14px] text-ink">{formatDayJa(s.sessionDate)}</span>
                    <span className="text-[12px] text-muted tnum">
                      第{s.slotNo}コマ {formatTimeRange(s.startTime, s.endTime)}
                    </span>
                    {isPast(s.sessionDate) ? null : (
                      <span className="ml-auto text-[11px] text-muted">これから</span>
                    )}
                  </div>
                  <div className="mt-[3px] text-[12px] text-muted">
                    {b?.name ?? '—'} ・ 生徒{s.students.length}名
                    {others.length > 1 ? ` ・ ${others.map((e) => e.name).join('・')}で${others.length}名体制` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Note>
        ここに出るのは<strong className="text-ink">確定した予定だけ</strong>です。調整中のものは表示されません。
        <strong className="text-ink">確定した担当コマがそのまま勤務実績</strong>になり、給与の計算に使われます。
      </Note>

      <DayDetailSheet
        date={day}
        slots={d.slots.filter((s) => s.sessionDate === day)}
        businesses={d.businesses}
        onClose={() => setDay(null)}
      />
    </div>
  );
}
