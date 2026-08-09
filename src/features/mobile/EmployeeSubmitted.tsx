import { Note } from '@/components/ui';
import { formatMonthJa } from '@/lib/date';
import { multiBusiness } from '@/lib/format';
import { MonthHeader } from './MonthHeader';
import { DayPickList, type DayPick } from './DayPickList';
import { openingKey, type Opening } from './openings';
import type { Business, WorkPreference } from '@/types/domain';

interface Props {
  month: string;
  onMonth: (m: string) => void;
  businesses: Business[];
  openings: Opening[];
  /** 自分が提出した勤務希望 */
  picks: WorkPreference[];
}

/**
 * 希望提出タブの「提出済みの月」。**出した希望だけ**を出す。
 * 理由は保護者側（→ ParentSubmitted）と同じ。
 */
export function EmployeeSubmitted({ month, onMonth, businesses, openings, picks }: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const openMap = new Map(
    openings.map((o) => [openingKey({ businessId: o.businessId, date: o.date, slotNo: o.slotNo }), o]),
  );
  /* 掛け持ちの人にだけ教室を出す。1教室しか担当しない人には同じ名前が全行に並ぶだけ */
  const showBiz = multiBusiness(picks.map((p) => p.businessId));

  const days: DayPick[] = picks.map((p) => {
    const o = openMap.get(
      openingKey({ businessId: p.businessId, date: p.sessionDate, slotNo: p.slotNo }),
    );
    const b = bizMap.get(p.businessId);
    return {
      key: p.id,
      date: p.sessionDate,
      startTime: o?.startTime ?? '00:00:00',
      endTime: o?.endTime ?? '00:00:00',
      colorKey: b?.colorKey ?? 'forest',
      meta: showBiz ? b?.name?.replace('教室', '') : undefined,
    };
  });

  return (
    <div>
      <MonthHeader month={month} onChange={onMonth} />

      <DayPickList
        days={days}
        label={`${formatMonthJa(month)} 提出した希望`}
        emptyTitle="「勤務なし」で提出しています。"
        emptyHint="この月は勤務できない、と管理者に伝わっています。"
      />

      <Note>
        この月は<strong className="text-ink">提出済み</strong>です。
        提出後は変更できません。
        出した希望がそのままシフトになるわけではなく、教室が調整して確定します。
        確定すると<strong className="text-ink">「予定」</strong>に出ます。
        変更が必要な場合は管理者にご連絡ください。
      </Note>
    </div>
  );
}
