import { Badge, Card } from '@/components/ui';
import type { Business } from '@/types/domain';

interface Group {
  key: string;
  businessId: string;
  sessionDate: string;
  slotNo: number;
  scheduleId: string | null;
  status: 'draft' | 'confirmed';
  wantStudents: { id: string; name: string }[];
  wantEmployees: { id: string; name: string }[];
  pickedStudents: string[];
  pickedEmployees: string[];
  capacity: number;
  isOverCapacity: boolean;
}

interface Props {
  group: Group;
  business?: Business;
  busy: boolean;
  onToggleStudent: (id: string) => void;
  onToggleEmployee: (id: string) => void;
}

/**
 * 1コマぶんのカード。
 * 希望＝点線、仮確定＝塗りつぶし。クリックで行き来する。
 * 定員は DB のビューが返した値をそのまま出す（ここで再計算しない）。
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
        <span className="text-[14px] text-ink">
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

      <div className="mb-xs flex items-baseline gap-xs text-[11px] font-medium tracking-[0.08em] text-muted">
        <span>担当講師</span>
        <span className="tnum">
          {g.pickedEmployees.length}名 ／ 定員 {g.capacity}名
        </span>
      </div>
      <div className="mb-md flex flex-wrap gap-xs">
        {g.wantEmployees.length === 0 ? (
          <span className="text-[12px] text-muted">勤務希望が出ていません</span>
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

      <div className="mb-xs flex items-baseline gap-xs text-[11px] font-medium tracking-[0.08em] text-muted">
        <span>受講生徒</span>
        <span className="tnum">
          {picked}名{g.capacity > 0 ? ` ／ 定員 ${g.capacity}名` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-xs">
        {g.wantStudents.length === 0 ? (
          <span className="text-[12px] text-muted">受講希望が出ていません</span>
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

      {g.isOverCapacity ? (
        <p className="mt-sm text-[12px] text-coral">
          定員を {picked - g.capacity}名 超えています。講師を追加すると定員が伸びます。
        </p>
      ) : null}
    </Card>
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
      className={`rounded-pill border px-sm py-[3px] text-[12px] transition-colors
        disabled:opacity-50 ${picked ? solid : dashed}`}
    >
      {label}
    </button>
  );
}
