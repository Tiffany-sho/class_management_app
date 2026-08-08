import type { Business, ScheduleSlot } from '@/types/domain';

/**
 * カレンダーのマスの中に何を出すか。
 *
 * - `business` … 事業ごとのコマ数（管理者）。どの教室が何コマ動くかを俯瞰する
 * - `assignment` … 生徒数だけ（講師の予定）。**自分がどちらの教室かは本人が
 *   知っている**ので教室名は出さない。講師名も出さない ―― 70px のマスに姓を
 *   詰め込んでも、それが相方なのか自分なのか読み取れず、数字の意味まで曇る。
 *   誰と組むかは押して開く詳細と下の一覧にある
 */
export type CellMode =
  | { kind: 'business' }
  | { kind: 'assignment' };

interface Props {
  slots: ScheduleSlot[];
  businesses: Business[];
  mode: CellMode;
}

/**
 * 1マスの中身。
 *
 * **切り詰めない。** 1マスは画面幅の1/7（スマホでは 70px ほど）しかないので、
 * 入らないものは出さずに済ませる。名前は姓だけにする。
 */
export function DayCellChips({ slots, businesses, mode }: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  if (mode.kind === 'assignment') {
    return (
      <>
        {[...slots].sort((a, b) => a.slotNo - b.slotNo).map((s) => (
          <Chip
            key={s.id}
            colorKey={bizMap.get(s.businessId)?.colorKey === 'forest' ? 'forest' : 'coral'}
            confirmed={s.status === 'confirmed'}
            title={`${bizMap.get(s.businessId)?.name ?? ''} 第${s.slotNo}コマ`
              + ` 生徒${s.students.length}名`
              + s.employees.map((e) => ` ${e.name}`).join('')}
          >
            <span className="tnum">{s.students.length}</span>
            <span>名</span>
          </Chip>
        ))}
      </>
    );
  }

  return (
    <>
      {groupByBusiness(slots).map(([businessId, list]) => {
        const b = bizMap.get(businessId);
        return (
          <Chip
            key={businessId}
            colorKey={b?.colorKey === 'forest' ? 'forest' : 'coral'}
            confirmed={list.every((s) => s.status === 'confirmed')}
            title={`${b?.name ?? ''} ${list.length}コマ`}
          >
            {/* 狭いときは色と数だけ。名前は真下の凡例に任せる */}
            <span className="hidden app:inline">{b?.name?.replace('教室', '') ?? '—'}</span>
            <span className="tnum">{list.length}</span>
            <span className="hidden sm:inline">コマ</span>
          </Chip>
        );
      })}
    </>
  );
}

function Chip({ colorKey, confirmed, title, children }: {
  colorKey: 'forest' | 'coral';
  confirmed: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const isProg = colorKey === 'forest';
  return (
    <span
      title={title}
      className={`flex items-center gap-[3px] whitespace-nowrap rounded-sm
        px-[5px] py-[2px] text-ui-2xs leading-tight
        ${confirmed
          ? isProg ? 'bg-forest text-on-dark' : 'bg-coral text-on-dark'
          : `border border-dashed ${isProg ? 'border-forest text-forest' : 'border-coral text-coral'}`}`}
    >
      {children}
    </span>
  );
}

function groupByBusiness(slots: ScheduleSlot[]): [string, ScheduleSlot[]][] {
  const m = new Map<string, ScheduleSlot[]>();
  for (const s of slots) {
    const list = m.get(s.businessId) ?? [];
    list.push(s);
    m.set(s.businessId, list);
  }
  return [...m.entries()];
}
