import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AdminLayout';
import { MonthCalendar, CalendarLegend, type DayState } from '@/components/calendar/MonthCalendar';
import { Loading, ErrorNote, MonthNav, SectionLabel, Panel } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchBusinesses, fetchScheduleMonth, fetchStudents, fetchFees,
  countPendingOvertime, countUnhandledAbsences, countPromotionCandidates,
} from '@/lib/queries';
import { currentMonthKey, isPast } from '@/lib/date';
import { DayDetailSheet } from './DayDetailSheet';
import { TodoList } from './TodoList';
import { NextPrevClass } from './NextPrevClass';
import { MonthSummary } from './MonthSummary';

/**
 * 管理者ホーム。
 * カレンダーを上部に全幅で置き、その下を2カラムにする。
 * 「両方の教室が確定して初めて確定した日」という判定はここで作る。
 */
export function AdminHomePage() {
  const [month, setMonth] = useState(currentMonthKey());
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  const state = useAsync(
    async () => {
      const [businesses, slots, students, fees, overtime, absences, promotions] = await Promise.all([
        fetchBusinesses(),
        fetchScheduleMonth(month),
        fetchStudents(),
        fetchFees(month),
        countPendingOvertime(),
        countUnhandledAbsences(),
        countPromotionCandidates(),
      ]);
      return { businesses, slots, students, fees, overtime, absences, promotions };
    },
    [month],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, DayState>();
    for (const s of state.data?.slots ?? []) {
      const cur = m.get(s.sessionDate) ?? { slots: [], allConfirmed: true };
      cur.slots.push(s);
      m.set(s.sessionDate, cur);
    }
    // 片方でも未確定なら未確定として扱う
    for (const [, v] of m) v.allConfirmed = v.slots.every((s) => s.status === 'confirmed');
    return m;
  }, [state.data?.slots]);

  const unconfirmedDays = useMemo(
    () => [...byDate.values()].filter((d) => !d.allConfirmed).length,
    [byDate],
  );

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  return (
    <div>
      <PageHeader title="ホーム" />

      <div className="mb-lg">
        <div className="mb-sm flex flex-wrap items-center gap-md">
          <MonthNav value={month} onChange={setMonth} />
          <div className="flex-1" />
          <CalendarLegend businesses={d.businesses} />
        </div>

        <MonthCalendar
          monthKey={month}
          byDate={byDate}
          businesses={d.businesses}
          onSelect={setSelected}
          showStatus
        />

        <p className="mt-sm text-[12px] leading-relaxed text-muted">
          チップは<strong className="text-ink">教室ごとの開催コマ数</strong>です。
          教室のある日をクリックすると、その日の<strong className="text-ink">講師と生徒</strong>が見られます。
          <strong className="text-ink">両方の教室が確定して初めて「確定した日」</strong>になり、
          片方でも未確定なら未確定の扱いです。
        </p>
      </div>

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <NextPrevClass slots={d.slots} businesses={d.businesses} onOpen={setSelected} />
        </div>
        <div>
          <SectionLabel>要対応</SectionLabel>
          <div className="mb-lg">
            <TodoList
              overtime={d.overtime}
              absences={d.absences}
              promotions={d.promotions}
              unconfirmedDays={unconfirmedDays}
              month={month}
              onGo={navigate}
            />
          </div>
          <SectionLabel>今月のサマリ</SectionLabel>
          <Panel>
            <MonthSummary
              students={d.students}
              fees={d.fees}
              slots={d.slots}
              heldDays={new Set(d.slots.map((s) => s.sessionDate)).size}
              pastSlots={d.slots.filter((s) => isPast(s.sessionDate))}
            />
          </Panel>
        </div>
      </div>

      <DayDetailSheet
        date={selected}
        slots={selected ? (byDate.get(selected)?.slots ?? []) : []}
        businesses={d.businesses}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
