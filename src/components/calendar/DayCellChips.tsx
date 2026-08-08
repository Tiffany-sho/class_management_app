import { surname } from '@/lib/format';
import type { Business, ScheduleSlot } from '@/types/domain';

/**
 * カレンダーのマスの中に何を出すか。
 *
 * - `business` … 事業ごとのコマ数（管理者）。どの教室が何コマ動くかを俯瞰する
 * - `assignment` … 一緒に入る講師 ・ 生徒数（講師の予定）。**自分がどちらの教室かは
 *   本人が知っている**ので、教室名を出しても情報が増えない。知りたいのは
 *   「誰と組むか」「何人来るか」
 */
export type CellMode =
  | { kind: 'business' }
  | { kind: 'assignment'; meId: string | null };

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
              + mates(s, mode.meId).map((m) => ` ${m}`).join('')}
          >
            <Mates slot={s} meId={mode.meId} />
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

/** 一緒に入る講師の姓。自分は出さない（毎マスに自分の名前が並んでも読むものが無い） */
function Mates({ slot, meId }: { slot: ScheduleSlot; meId: string | null }) {
  const names = mates(slot, meId);
  if (names.length === 0) return null;
  return (
    <span>
      {surname(names[0]!)}
      {names.length > 1 ? `+${names.length - 1}` : ''}
    </span>
  );
}

function mates(slot: ScheduleSlot, meId: string | null): string[] {
  return slot.employees.filter((e) => e.id !== meId).map((e) => e.name);
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
        px-[5px] py-[2px] text-[10px] leading-tight
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
