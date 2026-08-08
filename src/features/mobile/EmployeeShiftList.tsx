import { Card, Empty, Icon, SectionLabel } from '@/components/ui';
import { formatDayJa, formatTimeRange, isPast } from '@/lib/date';
import type { Business, ScheduleSlot } from '@/types/domain';

interface Props {
  slots: ScheduleSlot[];
  businesses: Business[];
  /** 2教室を掛け持ちしている講師にだけ教室名を出す（→ multiBusiness） */
  showBusiness: boolean;
  onOpen: (slot: ScheduleSlot) => void;
}

/**
 * その月の勤務一覧。
 *
 * **1行に出すのは「いつ・何時から・何人来るか」だけ。** 教室名もコマ番号も
 * 講師名も出さない ―― どちらの教室かは本人が知っているし、コマ番号は時刻より
 * 情報が少ない（時刻を見れば何コマ目かは分かるが、逆は分からない）。
 * 誰と組むかは押して開く詳細にある。
 *
 * **終わった回とこれからの回を分ける。** 混ぜて日付順に並べると、開いた瞬間に
 * 目に入るのが月初＝もう終わった回になり、いちばん確かめたい「次はいつか」を
 * 毎回スクロールして探すことになる。
 */
export function EmployeeShiftList({ slots, businesses, showBusiness, onOpen }: Props) {
  const sorted = [...slots].sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo);
  const upcoming = sorted.filter((s) => !isPast(s.sessionDate));
  const past = sorted.filter((s) => isPast(s.sessionDate));

  if (sorted.length === 0) {
    return (
      <Card className="mb-md">
        <Empty
          title="この月の担当はありません。"
          hint="スケジュールが確定すると、ここに出ます。"
        />
      </Card>
    );
  }

  return (
    <>
      {upcoming.length > 0 ? (
        <>
          <SectionLabel>予定 {upcoming.length}件</SectionLabel>
          <Card className="mb-md">
            <ul>
              {upcoming.map((s) => (
                <Row
                  key={s.id}
                  slot={s}
                  businesses={businesses}
                  showBusiness={showBusiness}
                  done={false}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <SectionLabel>終了 {past.length}件</SectionLabel>
          <Card className="mb-md">
            <ul>
              {past.map((s) => (
                <Row
                  key={s.id}
                  slot={s}
                  businesses={businesses}
                  showBusiness={showBusiness}
                  done
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </>
  );
}

function Row({ slot, businesses, showBusiness, done, onOpen }: {
  slot: ScheduleSlot;
  businesses: Business[];
  showBusiness: boolean;
  done: boolean;
  onOpen: (slot: ScheduleSlot) => void;
}) {
  const b = businesses.find((x) => x.id === slot.businessId);

  return (
    <li className="border-b border-hairline last:border-0">
      <button
        type="button"
        onClick={() => onOpen(slot)}
        className="flex w-full items-center gap-xs px-md py-sm text-left hover:bg-surface-soft"
      >
        <span
          aria-hidden
          className={`h-[9px] w-[9px] shrink-0 rounded-pill
            ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'} ${done ? 'opacity-45' : ''}`}
        />
        <span className={`whitespace-nowrap text-ui-md ${done ? 'text-muted' : 'text-ink'}`}>
          {formatDayJa(slot.sessionDate)}
        </span>
        <span className="whitespace-nowrap text-ui-sm text-muted tnum">
          {formatTimeRange(slot.startTime, slot.endTime)}
        </span>
        <span className="flex-1" />
        {showBusiness ? (
          <span className="whitespace-nowrap text-ui-sm text-muted">
            {b?.name?.replace('教室', '') ?? '—'}
          </span>
        ) : null}
        <span className="whitespace-nowrap text-ui-sm text-muted">
          生徒{slot.students.length}名
        </span>
        <Icon name="chevron-right" size={14} className="shrink-0 text-muted" />
      </button>
    </li>
  );
}
