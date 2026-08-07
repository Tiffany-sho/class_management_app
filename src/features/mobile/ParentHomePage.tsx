import { useMemo, useState } from 'react';
import { Badge, Card, Empty, Loading, ErrorNote, Note, SectionLabel } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchFees, fetchScheduleMonth, fetchStudents } from '@/lib/queries';
import { currentMonthKey, formatMonthJa, isPast } from '@/lib/date';
import { FEE_LABEL } from '@/lib/format';
import { MonthHeader } from './MonthHeader';
import { LessonItem } from './LessonItem';

/**
 * 保護者のホーム。今月の受講状況。
 *
 * 済んだ授業には**出欠と授業記録を同じ行に**出す。
 * 出席率は出さない（月2〜3回では1回の欠席で 67% になり実態を表さない）。
 * 月謝は固定月額なので、欠席が多くても請求額は変わらない。
 */
export function ParentHomePage() {
  const [month, setMonth] = useState(currentMonthKey());

  const state = useAsync(async () => {
    const [businesses, students, slots, fees] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchScheduleMonth(month), fetchFees(month),
    ]);
    return { businesses, students, slots, fees };
  }, [month]);

  const lessons = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
    // RLS が自分の子だけに絞っているので、ここで親子関係を条件に足さない
    return d.slots
      .flatMap((s) => s.students.map((st) => ({ slot: s, student: st })))
      .map(({ slot, student }) => ({
        key: `${slot.id}-${student.studentId}`,
        slot,
        student,
        biz: bizMap.get(slot.businessId),
        past: isPast(slot.sessionDate),
      }))
      .sort((a, b) => a.slot.sessionDate.localeCompare(b.slot.sessionDate) || a.slot.slotNo - b.slot.slotNo);
  }, [state.data]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const done = lessons.filter((l) => l.past);
  const upcoming = lessons.filter((l) => !l.past);

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth}>
        <div className="mt-sm flex justify-center gap-lg text-center">
          <div>
            <div className="text-[11px] text-muted">済んだ授業</div>
            <div className="text-[18px] font-medium text-ink tnum">{done.length}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">これから</div>
            <div className="text-[18px] font-medium text-ink tnum">{upcoming.length}</div>
          </div>
        </div>
        <p className="mt-xs text-center text-[11px] text-muted">左右に払うと月を移せます</p>
      </MonthHeader>

      <SectionLabel>月謝</SectionLabel>
      <Card className="mb-md">
        {d.students.length === 0 ? (
          <Empty title="登録されている生徒がいません。" hint="教室にお問い合わせください。" />
        ) : (
          <ul>
            {d.students.map((s, i) => {
              const fee = d.fees.get(s.id);
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-sm px-md py-sm ${i < d.students.length - 1 ? 'border-b border-hairline' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink">{s.name}</span>
                    <span className="block text-[12px] text-muted">
                      {s.gradeLabel} 月{s.sessionsPerMonth}回
                    </span>
                  </span>
                  {!fee ? (
                    <Badge tone="neutral">請求前</Badge>
                  ) : (
                    <span className="text-right">
                      <Badge tone={fee.status === 'paid' ? 'success' : 'danger'}>
                        {FEE_LABEL[fee.status]}
                      </Badge>
                      <span className="mt-[3px] block text-[11px] text-muted tnum">
                        {fee.paidDate ? `入金 ${fee.paidDate.slice(5)}` : '入金待ち'}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SectionLabel>済んだ授業と記録</SectionLabel>
      <Card className="mb-md">
        {done.length === 0 ? (
          <Empty title={`${formatMonthJa(month)}に済んだ授業はありません。`} />
        ) : (
          <ul>
            {done.map((l) => (
              <LessonItem
                key={l.key}
                sessionDate={l.slot.sessionDate}
                slotNo={l.slot.slotNo}
                startTime={l.slot.startTime}
                endTime={l.slot.endTime}
                businessName={l.biz?.name ?? '—'}
                colorKey={l.biz?.colorKey ?? 'forest'}
                past
                attendanceStatus={l.student.attendanceStatus}
                note={l.student.note}
                notedByName={l.student.notedByName}
                extra={<div className="text-[12px] text-ink">{l.student.studentName}</div>}
              />
            ))}
          </ul>
        )}
      </Card>

      <SectionLabel>これからの授業</SectionLabel>
      <Card className="mb-md">
        {upcoming.length === 0 ? (
          <Empty
            title="予定されている授業はありません。"
            hint="スケジュールが確定すると、ここに出ます。"
          />
        ) : (
          <ul>
            {upcoming.map((l) => (
              <LessonItem
                key={l.key}
                sessionDate={l.slot.sessionDate}
                slotNo={l.slot.slotNo}
                startTime={l.slot.startTime}
                endTime={l.slot.endTime}
                businessName={l.biz?.name ?? '—'}
                colorKey={l.biz?.colorKey ?? 'forest'}
                past={false}
                extra={<div className="text-[12px] text-ink">{l.student.studentName}</div>}
              />
            ))}
          </ul>
        )}
      </Card>

      <Note>
        月謝は<strong className="text-ink">固定月額</strong>です。お休みされても請求額は変わりません。
        出席率は出していません（月2〜3回のため、1回のお休みで数字が大きく振れて実態を表さないためです）。
      </Note>
    </div>
  );
}
