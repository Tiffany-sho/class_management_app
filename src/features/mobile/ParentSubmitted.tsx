import { Note } from '@/components/ui';
import { formatMonthJa } from '@/lib/date';
import { MonthHeader } from './MonthHeader';
import { KidSwitch } from './KidSwitch';
import { DayPickList, type DayPick } from './DayPickList';
import { openingKey, type Opening } from './openings';
import type { Business, Student } from '@/types/domain';

interface Props {
  month: string;
  onMonth: (m: string) => void;
  students: Student[];
  businesses: Business[];
  kid: Student;
  onKid: (id: string) => void;
  /** その月に開催されるコマ（時刻を引くために使う） */
  openings: Opening[];
  /** その子が提出した希望 */
  picks: { sessionDate: string; slotNo: number }[];
}

/**
 * 希望提出タブの「提出済みの月」。**出した希望だけ**を出す。
 *
 * 提出したあとも候補日が全部並んでいて、選択も提出ボタンも残っていた。
 * 一度出したものは変えられないと決めた以上（→ docs/domain.md 機能1）、
 * **押せるものを残しておくと「まだ変えられる」と読める**。
 *
 * 候補を並べたまま押せなくする手もあるが、出した4件が候補8件の中に埋もれて
 * 「何を出したか」が読み取りにくい。出したものだけを並べる。
 */
export function ParentSubmitted({
  month, onMonth, students, businesses, kid, onKid, openings, picks,
}: Props) {
  const biz = businesses.find((b) => b.id === kid.businessId);
  const openMap = new Map(
    openings.map((o) => [openingKey({ businessId: o.businessId, date: o.date, slotNo: o.slotNo }), o]),
  );

  const days: DayPick[] = picks.map((p) => {
    const o = openMap.get(
      openingKey({ businessId: kid.businessId, date: p.sessionDate, slotNo: p.slotNo }),
    );
    return {
      key: `${p.sessionDate}-${p.slotNo}`,
      date: p.sessionDate,
      startTime: o?.startTime ?? '00:00:00',
      endTime: o?.endTime ?? '00:00:00',
      colorKey: biz?.colorKey ?? 'forest',
    };
  });

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
        label={`${formatMonthJa(month)} 提出した希望`}
        emptyTitle={`${kid.name}さんは「希望なし」で提出しています。`}
        emptyHint="この月は通えない、と教室に伝わっています。"
      />

      <Note>
        この月は<strong className="text-ink">提出済み</strong>です。
        提出後は変更できません。
        このうち<strong className="text-ink">月{kid.sessionsPerMonth}コマ</strong>を教室が決め、
        確定すると<strong className="text-ink">「予定」</strong>に出ます。
        変更が必要な場合は教室にご連絡ください。
      </Note>
    </div>
  );
}
