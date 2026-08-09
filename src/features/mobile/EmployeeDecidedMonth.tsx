import { Note } from '@/components/ui';
import { formatMonthJa } from '@/lib/date';
import { multiBusiness } from '@/lib/format';
import { MonthHeader } from './MonthHeader';
import { DayPickList, type DayPick } from './DayPickList';
import type { Business, ScheduleSlot } from '@/types/domain';

interface Props {
  month: string;
  onMonth: (m: string) => void;
  businesses: Business[];
  /** その月の確定したコマ。講師には確定したものしか届かない（RLS） */
  schedule: ScheduleSlot[];
  employeeId: string | undefined;
}

/**
 * 希望提出タブの「確定した月」。出した希望ではなく**担当が決まった日だけ**を出す。
 *
 * 1行に出すのは「いつ・何時から・何人来るか」だけ（→ EmployeeShiftList と同じ）。
 * コマ番号は時刻より情報が少なく、講師名は本人しか並ばない。
 */
export function EmployeeDecidedMonth({
  month, onMonth, businesses, schedule, employeeId,
}: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const mine = schedule.filter((s) => s.employees.some((e) => e.id === employeeId));
  /* 掛け持ちの人にだけ教室を足す。1教室しか持たない人には同じ名前が全行に並ぶだけ */
  const showBiz = multiBusiness(mine.map((s) => s.businessId));

  const days: DayPick[] = mine.map((s) => {
    const name = bizMap.get(s.businessId)?.name?.replace('教室', '') ?? '—';
    return {
      key: s.id,
      date: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      colorKey: bizMap.get(s.businessId)?.colorKey ?? 'forest',
      meta: showBiz ? `${name} ・ 生徒${s.students.length}名` : `生徒${s.students.length}名`,
    };
  });

  return (
    <div>
      <MonthHeader month={month} onChange={onMonth} />

      <DayPickList
        days={days}
        label={`${formatMonthJa(month)} 決まった日`}
        emptyTitle="この月の担当はありません。"
        emptyHint="お心当たりがない場合は管理者にお問い合わせください。"
      />

      <Note>
        この月は<strong className="text-ink">シフトが確定しました</strong>。
        勤務希望の受付は終わっています。
        担当の中身は<strong className="text-ink">「予定」</strong>から見られます。
        変更が必要な場合は管理者にご連絡ください。
      </Note>
    </div>
  );
}
