import { useMemo, useState } from 'react';
import { Loading, ErrorNote, Note } from '@/components/ui';
import { MonthCalendar, CalendarLegend, type DayState } from '@/components/calendar/MonthCalendar';
import { DayDetailSheet } from '@/components/calendar/DayDetailSheet';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/features/auth/AuthProvider';
import { StudentDetailSheet } from '@/features/students/StudentDetailSheet';
import { StaffDetailSheet } from '@/features/staff/StaffDetailSheet';
import { fetchBusinesses, fetchScheduleMonth } from '@/lib/queries';
import { currentMonthKey } from '@/lib/date';
import { multiBusiness } from '@/lib/format';
import { MonthHeader } from './MonthHeader';
import { EmployeeShiftList } from './EmployeeShiftList';

/**
 * 講師の予定。
 *
 * **月カレンダーが主で、一覧はその下**（モックと同じ構成）。日曜は2教室が
 * 並行開催されるので、日単位で見ないと自分がどちらに入っているか分からない。
 *
 * **自分が担当するコマだけに絞るのはここ。** 以前は「RLS が返さないので絞り込みは
 * 要らない」と書いてあったが、それは誤りだった。`schedules` の select ポリシーは
 * 「管理者 または 確定済み」なので、**確定したコマは担当していない教室のぶんも
 * 全員に見える**（コマの行そのものには個人情報が無いため、その設計自体は正しい）。
 * 絞らずに出すと、他の講師のコマが自分の予定として並ぶ。
 *
 * 絞った結果ここに出るのは全部自分のコマなので、**教室名は書かない**
 * （掛け持ちの人だけ例外 → `multiBusiness`）。カレンダーのマスも一覧の行も、
 * 空いた場所は「誰と組むか・何人来るか」に使う。
 */
export function EmployeePlan() {
  const [month, setMonth] = useState(currentMonthKey());
  /** 日付を押したらその日ぜんぶ、コマを押したらその1コマだけ */
  const [detail, setDetail] = useState<{ date: string; ids: string[] | null } | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);
  const { user } = useAuth();
  const meId = user?.id ?? null;

  const state = useAsync(async () => {
    const [businesses, all] = await Promise.all([fetchBusinesses(), fetchScheduleMonth(month)]);
    const slots = all.filter((s) => meId && s.employees.some((e) => e.id === meId));
    return { businesses, slots };
  }, [month, meId ?? '']);

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

  const showBusiness = multiBusiness(d.slots.map((s) => s.businessId));
  const shown = detail
    ? d.slots.filter((s) => s.sessionDate === detail.date
      && (detail.ids === null || detail.ids.includes(s.id)))
    : [];

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      {/* **カレンダーは広い画面だけ。** 狭い画面ではカレンダーも日ごとの一覧になり、
          下の「予定 / 終了」とまったく同じコマが2回並ぶ。下の一覧のほうが
          予定と終了に分かれていて情報が多いので、そちらだけ残す。
          月の中でどの日に入っているかを俯瞰する値打ちは、升目で見えるときだけある。 */}
      <div className="hidden sm:block">
        <MonthCalendar
          monthKey={month}
          byDate={byDate}
          businesses={d.businesses}
          onSelect={(date) => setDetail({ date, ids: null })}
          cell={{ kind: 'assignment' }}
          narrow="none"
        />

        {/* 掛け持ちしていない人には色の凡例が要らない（1色しか出ない） */}
        {showBusiness ? (
          <div className="mt-sm">
            <CalendarLegend businesses={d.businesses} showStatus={false} />
          </div>
        ) : null}

        <p className="mt-sm text-ui-sm leading-relaxed text-muted">
          マスの数字は<strong className="text-ink">その回に来る生徒の人数</strong>です。
        </p>
      </div>

      <p className="mb-lg mt-sm text-ui-sm leading-relaxed text-muted">
        押すと生徒・出欠・一緒に入る講師が見られます。
      </p>

      <EmployeeShiftList
        slots={d.slots}
        businesses={d.businesses}
        showBusiness={showBusiness}
        onOpen={(s) => setDetail({ date: s.sessionDate, ids: [s.id] })}
      />

      <Note>
        出るのは<strong className="text-ink">確定したコマだけ</strong>です。
        これがそのまま勤務実績になり、給与の計算に使われます。
      </Note>

      <DayDetailSheet
        date={detail?.date ?? null}
        slots={shown}
        businesses={d.businesses}
        showBusinessName={showBusiness}
        onClose={() => setDetail(null)}
        onOpenStudent={setStudent}
        onOpenStaff={setStaff}
      />
      <StudentDetailSheet studentId={student} mode="employee" onClose={() => setStudent(null)} />
      <StaffDetailSheet
        employeeId={staff}
        meId={meId}
        mode="employee"
        month={month}
        onClose={() => setStaff(null)}
      />
    </div>
  );
}
