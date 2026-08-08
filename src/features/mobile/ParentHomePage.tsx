import { useMemo, useState } from 'react';
import { Card, Empty, Loading, ErrorNote, SectionLabel } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchAnnouncements, fetchBusinesses, fetchFees, fetchScheduleMonth, fetchStudents,
} from '@/lib/queries';
import { currentMonthKey, isPast, shiftMonth, sinceLabel, todayIso } from '@/lib/date';
import { KidSwitch } from './KidSwitch';
import { NextLessonCard } from './NextLessonCard';
import { FeeCard } from './FeeCard';
import { KidMonthPanel, type KidSession } from './KidMonthPanel';

/**
 * 保護者のホーム。
 *
 * **お子さま切替 → 次回の受講 → 月謝 → 受講状況 → お知らせ**。
 * モックには月謝のカードが無く、受講状況の見出しに小さなバッジで添えていたが、
 * 保護者がこのアプリで確かめたいものの筆頭なので、独立したカードに出す。
 * 兄弟でコースも回数も違うので、1人ずつに絞って見せる。
 *
 * 「次回」は表示中の月に引きずられてはいけない（8月を見ていても次回は9月）。
 * そのため今月と来月の予定を別に読んで、そこから最初の1件を選んでいる。
 */
export function ParentHomePage() {
  const [month, setMonth] = useState(currentMonthKey());
  const [kidId, setKidId] = useState('');

  /** 月に依らないもの。次回の判定には今月＋来月の予定が要る */
  const base = useAsync(async () => {
    const now = currentMonthKey();
    const [businesses, students, announcements, thisMonth, nextMonth] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchAnnouncements(),
      fetchScheduleMonth(now), fetchScheduleMonth(shiftMonth(now, 1)),
    ]);
    return { businesses, students, announcements, upcoming: [...thisMonth, ...nextMonth] };
  }, []);

  /** 表示中の月ぶん */
  const monthly = useAsync(async () => {
    const [slots, fees] = await Promise.all([fetchScheduleMonth(month), fetchFees(month)]);
    return { slots, fees };
  }, [month]);

  const students = base.data?.students ?? [];
  const kid = students.find((s) => s.id === kidId) ?? students[0];

  const sessions = useMemo<KidSession[]>(() => {
    if (!kid || !monthly.data || !base.data) return [];
    const bizMap = new Map(base.data.businesses.map((b) => [b.id, b]));
    return monthly.data.slots
      .flatMap((slot) => slot.students
        .filter((st) => st.studentId === kid.id)
        .map((st) => ({
          key: `${slot.id}-${st.studentId}`,
          sessionDate: slot.sessionDate,
          slotNo: slot.slotNo,
          startTime: slot.startTime,
          endTime: slot.endTime,
          colorKey: bizMap.get(slot.businessId)?.colorKey ?? 'forest',
          employeeNames: slot.employees.map((e) => e.name),
          past: isPast(slot.sessionDate),
          attendanceStatus: st.attendanceStatus,
          note: st.note,
          notedByName: st.notedByName,
        })))
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo);
  }, [kid, monthly.data, base.data]);

  const next = useMemo(() => {
    if (!kid || !base.data) return null;
    const bizMap = new Map(base.data.businesses.map((b) => [b.id, b]));
    const today = todayIso();
    return base.data.upcoming
      .filter((slot) => slot.sessionDate >= today
        && slot.students.some((st) => st.studentId === kid.id))
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo)
      .map((slot) => ({
        sessionDate: slot.sessionDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        colorKey: bizMap.get(slot.businessId)?.colorKey ?? ('forest' as const),
        detail: slot.employees.length ? `担当 ${slot.employees.map((e) => e.name).join('・')}` : undefined,
      }))[0] ?? null;
  }, [kid, base.data]);

  if (base.loading && !base.data) return <Loading />;
  if (base.error && !base.data) return <ErrorNote message={base.error} onRetry={base.reload} />;
  const d = base.data;
  if (!d) return null;

  if (!kid) {
    return (
      <Card>
        <Empty title="登録されている生徒がいません。" hint="教室にお問い合わせください。" />
      </Card>
    );
  }

  return (
    <div>
      <KidSwitch
        students={students}
        businesses={d.businesses}
        selectedId={kid.id}
        onSelect={setKidId}
      />

      <NextLessonCard
        label="次回の受講"
        lesson={next}
        emptyText="次の予定はまだ確定していません。確定するとここに出ます。"
      />

      {monthly.error && !monthly.data ? (
        <ErrorNote message={monthly.error} onRetry={monthly.reload} />
      ) : (
        <>
          <FeeCard month={month} fee={monthly.data?.fees.get(kid.id) ?? null} />
          <KidMonthPanel
            studentName={kid.name}
            month={month}
            onMonth={setMonth}
            sessions={sessions}
          />
        </>
      )}

      <SectionLabel>お知らせ</SectionLabel>
      <Card>
        {d.announcements.length === 0 ? (
          <Empty title="お知らせはありません。" />
        ) : (
          <ul>
            {/* 全部は出さない。続きは「お知らせ」タブにある */}
            {d.announcements.slice(0, 3).map((a, i) => (
              <li
                key={a.id}
                className={`px-md py-sm ${i < Math.min(d.announcements.length, 3) - 1 ? 'border-b border-hairline' : ''}`}
              >
                <div className="text-ui-md text-ink">{a.title}</div>
                <div className="mt-[3px] text-ui-sm text-muted">
                  {sinceLabel(a.sentAt ?? a.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
