import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Card, Empty, Loading, ErrorNote, Note, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  fetchAbsenceReports, fetchBusinesses, fetchEmployees, fetchMonthlyPay, fetchScheduleMonth,
  setAttendance, toggleScheduleEmployee,
} from '@/lib/queries';
import { currentMonthKey, formatDayJa, todayIso } from '@/lib/date';
import type { AttendanceStatus } from '@/types/domain';
import { StudentDetailSheet } from '@/features/students/StudentDetailSheet';
import { StaffDetailSheet } from '@/features/staff/StaffDetailSheet';
import { DayNav } from './DayNav';
import { DaySlotCard } from './DaySlotCard';

/**
 * 当日の変更。急な欠席・欠勤をその場で反映する。
 *
 * スケジュール確定（翌月ぶんを組む画面）とは目的が違う。**あちらは「これからの月を作る」、
 * ここは「もう決まった日を直す」。** 同じ画面にすると、月を組んでいる途中で
 * 今日の回を触ってしまい、確定済みの勤務実績が意図せず動く。
 *
 * ここでの変更は**そのまま給与に効く**（確定したコマ = 勤務実績）。
 * ただし給与を締めた月は payrolls の値が正になるので、直しても金額は動かない。
 * その月が締まっているときは警告を出す。
 */
export function DayChangePage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState<string | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);

  const month = date.slice(0, 7);

  const state = useAsync(async () => {
    const [businesses, employees, slots, absences, pays] = await Promise.all([
      fetchBusinesses(), fetchEmployees(), fetchScheduleMonth(month),
      fetchAbsenceReports(), fetchMonthlyPay(month),
    ]);
    return { businesses, employees, slots, absences, pays };
  }, [month]);

  const slots = useMemo(
    () => (state.data?.slots ?? [])
      .filter((s) => s.sessionDate === date)
      .sort((a, b) => a.slotNo - b.slotNo || a.businessId.localeCompare(b.businessId)),
    [state.data, date],
  );

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  /* その日に欠席連絡が来ている生徒。届いた連絡と画面の出欠を突き合わせられるようにする
     （連絡は来ているのに出欠が「出席」のまま、という取りこぼしを見つけるため） */
  const reported = new Set(
    d.absences.filter((a) => a.sessionDate === date).map((a) => a.studentId),
  );

  const payrollClosed = d.pays.some((p) => p.status === 'confirmed');

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

  const toggleEmployee = (slotId: string, businessId: string, employeeId: string, assigned: boolean) => {
    const name = d.employees.find((e) => e.id === employeeId)?.name ?? '講師';
    void run(
      `emp-${slotId}-${employeeId}`,
      () => toggleScheduleEmployee(slotId, businessId, employeeId, assigned),
      assigned
        ? `${name} をこのコマから外しました。このコマぶんの給与は付きません`
        : `${name} をこのコマの担当に追加しました。このコマぶんの給与が付きます`,
    );
  };

  const mark = (slotId: string, studentId: string, status: AttendanceStatus) => {
    const name = slots
      .find((s) => s.id === slotId)?.students
      .find((x) => x.studentId === studentId)?.studentName ?? '生徒';
    void run(
      `stu-${slotId}-${studentId}`,
      () => setAttendance(slotId, studentId, status),
      status === 'absent'
        ? `${name} を欠席にしました（授業記録は残りません）`
        : `${name} の出欠を記録しました`,
    );
  };

  const unassigned = slots.filter((s) => s.employees.length === 0).length;

  return (
    <div>
      <PageHeader
        title="当日の変更"
        description="急な欠席・欠勤をこの画面で反映します。"
        actions={<DayNav value={date} onChange={setDate} />}
      />

      <Note icon={unassigned ? 'warning' : 'info'}>
        <strong className="text-ink">コマごとに「講師を追加」から足せます。</strong>
        代役に限らず、単に1名増やすときもここから足してください。出せるのは
        <strong className="text-ink">その教室を担当できる講師だけ</strong>です
        （時給が教室ごとに決まるためで、増やすには「講師」ページで担当教室を設定します）。<br />
        講師を外すと、<strong className="text-ink">その回は勤務実績から消え、給与もそのぶん下がります</strong>
        （確定したコマがそのまま実績になるためです）。足した講師には、その回のぶんが付きます。<br />
        生徒は<strong className="text-ink">外さずに欠席にしてください</strong>。外すと「その日に来る予定だった」
        ことまで消え、保護者のマイページから記録ごと無くなります。
        月謝は固定月額なので、欠席にしても請求額は変わりません。
        {unassigned ? (
          <>
            <br />
            <strong className="text-ink">担当がいないコマが {unassigned}件あります。</strong>
          </>
        ) : null}
      </Note>

      {payrollClosed ? (
        <Note icon="warning">
          <strong className="text-ink">この月の給与はすでに締められています。</strong>
          ここで担当を直しても、確定済みの講師の支給額は動きません
          （締めた時点の金額を記録してあるためです）。
          金額まで直す必要があるときは、Supabase のダッシュボードで
          <code>payrolls</code> の該当行を消してから締め直してください。
        </Note>
      ) : null}

      {slots.length === 0 ? (
        <Card>
          <Empty
            title={`${formatDayJa(date)}に開催されるコマはありません。`}
            hint={month === currentMonthKey()
              ? '開催曜日はマスタの「開催枠」で決まっています。'
              : 'スケジュールを確定すると、ここに出ます。'}
          />
        </Card>
      ) : (
        slots.map((s) => (
          <DaySlotCard
            key={s.id}
            slot={s}
            business={d.businesses.find((b) => b.id === s.businessId)}
            candidates={d.employees
              .filter((e) => e.active && e.businessIds.includes(s.businessId))
              .map((e) => ({ id: e.id, name: e.name }))}
            reportedStudentIds={reported}
            busy={busy}
            onToggleEmployee={(id, assigned) => toggleEmployee(s.id, s.businessId, id, assigned)}
            onMark={(studentId, status) => mark(s.id, studentId, status)}
            onOpenStudent={setStudent}
            onOpenStaff={setStaff}
          />
        ))
      )}

      <StudentDetailSheet studentId={student} mode="admin" onClose={() => setStudent(null)} />
      <StaffDetailSheet
        employeeId={staff}
        mode="admin"
        month={month}
        onClose={() => setStaff(null)}
      />
    </div>
  );
}
