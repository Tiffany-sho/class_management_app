import { yen } from '@/lib/format';
import type { ScheduleSlot, Student } from '@/types/domain';
import type { StudentFee } from '@/lib/queries';

interface Props {
  students: Student[];
  fees: Map<string, StudentFee>;
  slots: ScheduleSlot[];
  heldDays: number;
  pastSlots: ScheduleSlot[];
}

/**
 * 今月のサマリ。
 * 出席率は出さない ― 月2〜3回しか通わないので、1回休むと 67% になり
 * 実態より悪く見える。回数（のべ受講・欠席）だけを出す。
 */
export function MonthSummary({ students, fees, slots, heldDays, pastSlots }: Props) {
  const billed = [...fees.values()].reduce((a, f) => a + f.amount, 0);
  const paid = [...fees.values()].reduce((a, f) => a + (f.status === 'paid' ? f.amount : 0), 0);

  const attended = pastSlots.reduce((a, s) => a + s.students.length, 0);
  const absent = pastSlots.reduce(
    (a, s) => a + s.students.filter((x) => x.attendanceStatus === 'absent').length, 0,
  );

  const rows: [string, React.ReactNode][] = [
    ['在籍生徒', `${students.length}名`],
    ['今月の開催日', `${heldDays}日`],
    ['今月のコマ', `${slots.length}コマ`],
    [
      'のべ受講',
      <>
        {attended}回 <span className="text-muted">（うち欠席 {absent}）</span>
      </>,
    ],
    [
      '月謝の入金',
      billed === 0
        ? <span className="text-muted">この月はまだ請求していません</span>
        : <>{yen(paid)} <span className="text-muted">/ {yen(billed)}</span></>,
    ],
  ];

  return (
    <div>
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={`flex items-baseline justify-between py-sm
            ${i < rows.length - 1 ? 'border-b border-hairline' : ''}`}
        >
          <span className="text-ui-base text-muted">{k}</span>
          <span className="text-ui-lg text-ink tnum">{v}</span>
        </div>
      ))}
    </div>
  );
}
