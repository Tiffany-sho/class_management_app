import { useState } from 'react';
import {
  Card, Empty, ErrorNote, Loading, Note, Panel, SectionLabel, useToast,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { StudentDetailSheet } from '@/features/students/StudentDetailSheet';
import { StaffDetailSheet } from '@/features/staff/StaffDetailSheet';
import { setAttendance, setLessonNote } from '@/lib/queries';
import { currentMonthKey, formatDayJa, formatTimeRange } from '@/lib/date';
import { toMessage } from '@/lib/supabase';
import type { AttendanceStatus } from '@/types/domain';
import { AttendanceList } from './AttendanceList';
import { LessonNoteSheet, type NoteTarget } from './LessonNoteSheet';
import { NextLessonCard } from './NextLessonCard';
import { SameDaySlots } from './SameDaySlots';
import { useEmployeeDay, type DaySlot } from './useEmployeeDay';

/**
 * 講師のホーム（担当）。モックの「担当」タブと同じ3段構成にする。
 *
 *   直近の担当 → 出席 → 同日の自分の担当
 *
 * **月ぶんのコマを並べない。** 開いて確かめたいのは「次はいつで、誰が来るか」で、
 * 月の一覧の中にそれが埋もれると毎回探すことになる。
 *
 * 生徒名・講師名は押せる。押すとそれぞれの詳細が開く（講師には月謝も他人の
 * 労働条件も出ない ―― 出さないのではなく RLS が返さない）。
 */
export function EmployeeHomePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const meId = user?.id ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<NoteTarget | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);

  const { state, next, sameDay, unrecorded, mineCount } = useEmployeeDay(meId);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const mark = (slot: DaySlot, studentId: string, status: AttendanceStatus) => {
    const name = slot.slot.students.find((x) => x.studentId === studentId)?.studentName ?? '生徒';
    void run(
      `${slot.slot.id}-${studentId}`,
      () => setAttendance(slot.slot.id, studentId, status),
      status === 'absent'
        ? `${name} を欠席にしました（授業記録は残りません）`
        : `${name} の出欠を記録しました`,
    );
  };

  const openNote = (slot: DaySlot, studentId: string) => {
    const st = slot.slot.students.find((x) => x.studentId === studentId);
    if (!st) return;
    setNote({
      scheduleId: slot.slot.id,
      studentId,
      studentName: st.studentName,
      sessionDate: slot.slot.sessionDate,
      slotNo: slot.slot.slotNo,
      current: st.note ?? '',
    });
  };

  const saveNote = (text: string) => {
    const t = note;
    if (!t) return;
    void run(
      `${t.scheduleId}-${t.studentId}`,
      async () => {
        await setLessonNote(t.scheduleId, t.studentId, text);
        setNote(null);
      },
      text.trim() ? '授業記録を保存しました' : '授業記録を消しました',
    );
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  return (
    <div>
      <SectionLabel>直近の担当</SectionLabel>
      <NextLessonCard
        label={`担当コマ ${mineCount}件（今月・来月）`}
        lesson={next ? {
          sessionDate: next.slot.sessionDate,
          slotNo: next.slot.slotNo,
          startTime: next.slot.startTime,
          endTime: next.slot.endTime,
          colorKey: next.business?.colorKey ?? 'forest',
          detail: `生徒${next.slot.students.length}名`,
        } : null}
        emptyText="担当するコマはまだありません。スケジュールが確定すると出ます。"
      />

      {next ? (
        <Panel
          title="出席"
          description={`${formatDayJa(next.slot.sessionDate)} ${formatTimeRange(next.slot.startTime, next.slot.endTime)} ・ 押すと記録されます`}
        >
          <AttendanceList
            slot={next.slot}
            busy={busy}
            onMark={(id, s) => mark(next, id, s)}
            onOpenNote={(id) => openNote(next, id)}
            onOpenStudent={setStudent}
          />
        </Panel>
      ) : null}

      {next ? (
        <Panel title="同日の自分の担当">
          <SameDaySlots slots={sameDay} meId={meId} onOpenStaff={setStaff} />
        </Panel>
      ) : null}

      {/* モックには無い。これが無いと、休んだ日の記録を後から入れる手段が無くなる */}
      {unrecorded.length > 0 ? (
        <>
          <SectionLabel>記録がまだのコマ</SectionLabel>
          <Note icon="warning">
            出欠が未記録のコマが <strong className="text-ink">{unrecorded.length}件</strong> あります。
            記録しないと保護者のマイページに何も出ません。
          </Note>
          {unrecorded.map((x) => (
            <Card key={x.slot.id} className="mb-md p-md">
              <div className="mb-sm flex flex-wrap items-center gap-xs">
                <span
                  aria-hidden
                  className={`h-[9px] w-[9px] rounded-pill ${x.business?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                />
                <span className="text-[14px] text-ink">{formatDayJa(x.slot.sessionDate)}</span>
                <span className="text-[12px] text-muted">第{x.slot.slotNo}コマ</span>
              </div>
              <AttendanceList
                slot={x.slot}
                busy={busy}
                onMark={(id, s) => mark(x, id, s)}
                onOpenNote={(id) => openNote(x, id)}
                onOpenStudent={setStudent}
              />
            </Card>
          ))}
        </>
      ) : null}

      {mineCount === 0 ? (
        <Card><Empty title="担当しているコマがありません。" /></Card>
      ) : null}

      <Note>
        出欠と授業記録は<strong className="text-ink">同じ1件</strong>として保存されます。
        欠席にすると記録は残りません（休んだ回に所見だけが残ることを防ぐためです）。<br />
        <strong className="text-ink">生徒名・講師名を押すと詳細が開きます。</strong>
      </Note>

      <LessonNoteSheet
        target={note}
        busy={busy !== null}
        onCancel={() => setNote(null)}
        onSave={saveNote}
      />
      <StudentDetailSheet studentId={student} mode="employee" onClose={() => setStudent(null)} />
      <StaffDetailSheet
        employeeId={staff}
        meId={meId}
        mode="employee"
        month={currentMonthKey()}
        onClose={() => setStaff(null)}
      />
    </div>
  );
}
