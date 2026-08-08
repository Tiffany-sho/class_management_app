import { Badge, Card } from '@/components/ui';
import type { Business } from '@/types/domain';
import type { SlotGroup } from './useScheduleBoard';

interface Props {
  group: SlotGroup;
  business?: Business;
  busy: boolean;
  onToggleStudent: (id: string) => void;
  onToggleEmployee: (id: string) => void;
}

/**
 * 1コマぶんのカード。
 * 希望＝点線、仮確定＝塗りつぶし。クリックで行き来する。
 * 定員は DB のビューが返した値をそのまま出す（ここで再計算しない）。
 *
 * **チップに出すのは提出された希望だけ。** ここは希望を確定に変える画面なので、
 * 希望を出していない人を混ぜると「誰が出したのか」が読めなくなる。
 * ただし人数と定員は実際の割り当てから来るので、出さないぶんは数だけ添える。
 *
 * **確定済みのコマから外すときだけ、ページ側が確認をはさむ。**
 * 下書きは押した時点で入る／外れる。
 */
export function SlotCard({ group: g, business, busy, onToggleStudent, onToggleEmployee }: Props) {
  const isProg = business?.colorKey === 'forest';
  const picked = g.pickedStudents.length;
  const noEmployee = g.pickedEmployees.length === 0;

  return (
    <Card className="p-md">
      <header className="mb-sm flex flex-wrap items-center gap-xs">
        <span
          aria-hidden
          className={`h-[9px] w-[9px] rounded-pill ${isProg ? 'bg-forest' : 'bg-coral'}`}
        />
        <span className="text-ui-md text-ink">
          {business?.name ?? '—'} 第{g.slotNo}コマ
        </span>
        <span className="flex-1" />
        {/* 担当未定を先に出す。0人のとき本当の問題は定員超過ではない */}
        {noEmployee && picked > 0 ? (
          <Badge tone="danger">担当未定</Badge>
        ) : g.isOverCapacity ? (
          <Badge tone="danger">定員超過</Badge>
        ) : g.status === 'confirmed' ? (
          <Badge tone="success">確定</Badge>
        ) : (
          <Badge tone="neutral">下書き</Badge>
        )}
      </header>

      <div className="mb-xs flex items-baseline gap-xs text-ui-xs font-medium tracking-[0.08em] text-muted">
        <span>担当講師</span>
        <span className="tnum">
          {g.pickedEmployees.length}名 ／ 定員 {g.capacity}名
        </span>
      </div>
      <div className="mb-md">
        <div className="flex flex-wrap gap-xs">
          {g.wantEmployees.length === 0 ? (
            <span className="text-ui-sm text-muted">勤務希望が出ていません</span>
          ) : (
            g.wantEmployees.map((e) => (
              <PickChip
                key={e.id}
                label={e.name}
                picked={g.pickedEmployees.includes(e.id)}
                tone={isProg ? 'forest' : 'coral'}
                disabled={busy}
                onClick={() => onToggleEmployee(e.id)}
              />
            ))
          )}
        </div>
        <HiddenNote count={g.hiddenEmployees} what="担当" />
      </div>

      <div className="mb-xs flex items-baseline gap-xs text-ui-xs font-medium tracking-[0.08em] text-muted">
        <span>受講生徒</span>
        <span className="tnum">
          {picked}名{g.capacity > 0 ? ` ／ 定員 ${g.capacity}名` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-xs">
        {g.wantStudents.length === 0 ? (
          <span className="text-ui-sm text-muted">受講希望が出ていません</span>
        ) : (
          g.wantStudents.map((s) => (
            <PickChip
              key={s.id}
              label={s.name}
              picked={g.pickedStudents.includes(s.id)}
              tone={isProg ? 'forest' : 'coral'}
              disabled={busy}
              onClick={() => onToggleStudent(s.id)}
            />
          ))
        )}
      </div>
      <HiddenNote count={g.hiddenStudents} what="受講" />

      {g.isOverCapacity ? (
        <p className="mt-sm text-ui-sm text-coral">
          定員を {picked - g.capacity}名 超えています。講師を追加すると定員が伸びます。
        </p>
      ) : null}
    </Card>
  );
}

/**
 * 希望を出していないのに割り当てられている人数。
 * 出さないまま黙っていると「2名と書いてあるのにチップが1つ」になって、
 * 数え違いなのか表示漏れなのか分からなくなる。
 */
function HiddenNote({ count, what }: { count: number; what: '担当' | '受講' }) {
  if (count === 0) return null;
  return (
    <p className="mt-xs text-ui-sm text-muted">
      希望を出していない{count}名が{what}に入っています（当日の変更から直せます）。
    </p>
  );
}

function PickChip({
  label, picked, tone, disabled, onClick,
}: {
  label: string; picked: boolean; tone: 'forest' | 'coral'; disabled: boolean; onClick: () => void;
}) {
  const solid = tone === 'forest' ? 'bg-forest text-on-dark border-forest' : 'bg-coral text-on-dark border-coral';
  const dashed = tone === 'forest'
    ? 'border-dashed border-forest text-forest bg-canvas'
    : 'border-dashed border-coral text-coral bg-canvas';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={picked}
      /* 押したときに何が起きるかを、色だけでなく言葉でも出す。
         塗りつぶし＝外れる、点線＝入る、は色を見分けられないと伝わらない */
      title={picked ? `${label} を外す` : `${label} を仮確定する`}
      className={`rounded-pill border px-sm py-[3px] text-ui-sm transition-colors
        disabled:opacity-50 ${picked ? solid : dashed}`}
    >
      {label}
    </button>
  );
}
