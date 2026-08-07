import { useMemo, useState } from 'react';
import {
  Badge, Button, Card, Empty, Loading, ErrorNote, Note, Segmented, SectionLabel,
  TextArea, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { fetchBusinesses, fetchScheduleMonth, setAttendance, setLessonNote } from '@/lib/queries';
import { currentMonthKey, formatDayJa, formatTimeRange, isPast } from '@/lib/date';
import { MonthHeader } from './MonthHeader';
import type { AttendanceStatus } from '@/types/domain';

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: '出席' },
  { value: 'late', label: '遅刻' },
  { value: 'absent', label: '欠席' },
];

/**
 * 講師のホーム（担当コマ）。
 *
 * 出欠と授業記録は**同じ1行**なので、ここで両方入力する。
 * 欠席にすると記録は残せない（DB のトリガーが note を落とす）。
 * 書けるのは自分が担当しているコマだけで、これは RLS が保証している。
 */
export function EmployeeHomePage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [businesses, slots] = await Promise.all([fetchBusinesses(), fetchScheduleMonth(month)]);
    return { businesses, slots };
  }, [month]);

  const days = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
    return d.slots
      .map((s) => ({ slot: s, biz: bizMap.get(s.businessId), past: isPast(s.sessionDate) }))
      .sort((a, b) =>
        a.slot.sessionDate.localeCompare(b.slot.sessionDate) || a.slot.slotNo - b.slot.slotNo);
  }, [state.data]);

  const mark = async (
    scheduleId: string, studentId: string, status: AttendanceStatus,
  ) => {
    const key = `${scheduleId}-${studentId}`;
    setBusy(key);
    try {
      await setAttendance(scheduleId, studentId, status);
      toast(status === 'absent' ? '欠席にしました（記録は残りません）' : '出欠を記録しました');
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async (scheduleId: string, studentId: string) => {
    const key = `${scheduleId}-${studentId}`;
    setBusy(key);
    try {
      await setLessonNote(scheduleId, studentId, notes[key] ?? '');
      toast('授業記録を保存しました');
      setNotes((p) => { const { [key]: _drop, ...rest } = p; return rest; });
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  const totalSlots = days.length;
  const unmarked = days
    .filter((x) => x.past)
    .reduce((a, x) => a + x.slot.students.filter((s) => !s.attendanceStatus).length, 0);

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth}>
        <div className="mt-sm flex justify-center gap-lg text-center">
          <div>
            <div className="text-[11px] text-muted">担当コマ</div>
            <div className="text-[18px] font-medium text-ink tnum">{totalSlots}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">未マーク</div>
            <div className={`text-[18px] font-medium tnum ${unmarked ? 'text-coral' : 'text-ink'}`}>
              {unmarked}
            </div>
          </div>
        </div>
      </MonthHeader>

      {unmarked > 0 ? (
        <Note icon="warning">
          出欠が未記録の生徒が <strong className="text-ink">{unmarked}名</strong> います。
          記録しないと保護者のマイページに何も出ません。
        </Note>
      ) : null}

      <SectionLabel>担当コマ</SectionLabel>
      {days.length === 0 ? (
        <Card><Empty title="この月に担当しているコマはありません。" /></Card>
      ) : (
        days.map(({ slot, biz, past }) => (
          <Card key={slot.id} className="mb-md">
            <div className="flex flex-wrap items-center gap-xs border-b border-hairline px-md py-sm">
              <span
                aria-hidden
                className={`h-[9px] w-[9px] rounded-pill ${biz?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              <span className="text-[14px] text-ink">{formatDayJa(slot.sessionDate)}</span>
              <span className="text-[12px] text-muted tnum">
                {formatTimeRange(slot.startTime, slot.endTime)}
              </span>
              <span className="text-[12px] text-muted">{biz?.name ?? '—'} 第{slot.slotNo}コマ</span>
              {past ? null : <Badge tone="info">予定</Badge>}
            </div>

            {slot.students.length === 0 ? (
              <div className="px-md py-sm text-[13px] text-muted">受講生徒はいません。</div>
            ) : (
              <ul>
                {slot.students.map((st) => {
                  const key = `${slot.id}-${st.studentId}`;
                  const editing = notes[key] !== undefined;
                  return (
                    <li key={st.studentId} className="border-b border-hairline px-md py-sm last:border-0">
                      <div className="flex items-center gap-sm">
                        <span className="min-w-0 flex-1 text-[14px] text-ink">{st.studentName}</span>
                        {past ? (
                          <Segmented
                            value={st.attendanceStatus ?? ''}
                            options={OPTIONS}
                            onChange={(v) => void mark(slot.id, st.studentId, v)}
                            disabled={busy === key}
                          />
                        ) : null}
                      </div>

                      {past && st.attendanceStatus !== 'absent' ? (
                        <div className="mt-xs">
                          {editing ? (
                            <>
                              <TextArea
                                rows={3}
                                value={notes[key] ?? ''}
                                onChange={(e) => setNotes((p) => ({ ...p, [key]: e.target.value }))}
                                placeholder="今日進めた内容や様子を書きます"
                              />
                              <div className="mt-xs flex gap-xs">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={busy === key}
                                  onClick={() => void saveNote(slot.id, st.studentId)}
                                >
                                  保存
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => setNotes((p) => {
                                    const { [key]: _drop, ...rest } = p; return rest;
                                  })}
                                >
                                  やめる
                                </Button>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="text-left text-[12px] leading-relaxed text-muted underline decoration-hairline"
                              onClick={() => setNotes((p) => ({ ...p, [key]: st.note ?? '' }))}
                            >
                              {st.note ?? '授業記録を書く'}
                            </button>
                          )}
                        </div>
                      ) : null}

                      {past && st.attendanceStatus === 'absent' ? (
                        <div className="mt-[4px] text-[12px] text-muted">
                          欠席のため授業記録はありません。
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))
      )}

      <Note>
        出欠と授業記録は<strong className="text-ink">同じ1件</strong>として保存されます。
        欠席にすると記録は残りません（休んだ回に所見だけが残ることを防ぐためです）。
      </Note>
    </div>
  );
}
