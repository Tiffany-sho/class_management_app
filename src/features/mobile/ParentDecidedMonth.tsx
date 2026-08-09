import { Note } from '@/components/ui';
import { formatMonthJa } from '@/lib/date';
import { MonthHeader } from './MonthHeader';
import { KidSwitch } from './KidSwitch';
import { DayPickList, type DayPick } from './DayPickList';
import type { Business, ScheduleSlot, Student } from '@/types/domain';

interface Props {
  month: string;
  onMonth: (m: string) => void;
  students: Student[];
  businesses: Business[];
  kid: Student;
  onKid: (id: string) => void;
  /** その月の確定したコマ。保護者には確定したものしか届かない（RLS） */
  schedule: ScheduleSlot[];
}

/**
 * 希望提出タブの「確定した月」。候補ではなく**決まった日だけ**を出す。
 *
 * 子ごとに決まった日が違うので、お子さま切替はここでも残す。
 * 欠席の連絡はここには置かない ―― 予定タブにあり、2か所に置くと
 * 片方だけ直したときに食い違う。
 */
export function ParentDecidedMonth({
  month, onMonth, students, businesses, kid, onKid, schedule,
}: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const days: DayPick[] = schedule
    .filter((s) => s.students.some((st) => st.studentId === kid.id))
    .map((s) => ({
      key: s.id,
      date: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      colorKey: bizMap.get(s.businessId)?.colorKey ?? 'forest',
    }));

  return (
    <div>
      <MonthHeader month={month} onChange={onMonth} />

      <KidSwitch
        students={students}
        businesses={businesses}
        selectedId={kid.id}
        onSelect={onKid}
      />

      <DayPickList
        days={days}
        label={`${formatMonthJa(month)} 決まった日`}
        emptyTitle={`${kid.name}さんの受講日は、この月にはありません。`}
        emptyHint="お心当たりがない場合は教室にお問い合わせください。"
      />

      <Note>
        この月は<strong className="text-ink">予定が確定しました</strong>。
        希望の受付は終わっています。
        お休みの連絡は<strong className="text-ink">「予定」</strong>から、
        変更が必要な場合は教室にご連絡ください。
      </Note>
    </div>
  );
}
