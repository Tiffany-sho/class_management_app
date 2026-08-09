import { Badge, Card, Icon } from '@/components/ui';
import type { Business } from '@/types/domain';
import type { Candidate, SlotGroup } from './useScheduleBoard';

interface Props {
  group: SlotGroup;
  business?: Business;
  busy: boolean;
  /** その月に希望が出ているか。出ていない月は！を付けない（→ useScheduleBoard） */
  compare: { students: boolean; employees: boolean };
  onToggleStudent: (id: string) => void;
  onToggleEmployee: (id: string) => void;
}

/**
 * 1コマぶんのカード。
 * 希望＝点線、仮確定＝塗りつぶし。クリックで行き来する。
 * 定員は DB のビューが返した値をそのまま出す（ここで再計算しない）。
 *
 * **割り当てられている人は、希望を出していなくても必ずチップに出す。**
 * 以前は希望を出した人だけを出して、それ以外は人数だけ添えていた。その結果
 * **希望を出していないのに割り当てられている人を外す手段が画面に無く**、
 * 「全部外したつもりのコマだけが残って確定される」事故が起きた。
 * 見分けはつくようにする（！つきのチップ）が、**外せることを優先する**。
 *
 * **確定したコマはここでは触れない。** 確定は保護者・講師の画面にもう出ていて、
 * 講師なら給与にも効いている。組み立て中の月と同じ操作で動かせると、
 * 翌月を作っている途中に今月の実績が変わる。直すのは「当日の変更」から。
 */
export function SlotCard({
  group: g, business, busy, compare, onToggleStudent, onToggleEmployee,
}: Props) {
  const isProg = business?.colorKey === 'forest';
  const picked = g.pickedStudents.length;
  const noEmployee = g.pickedEmployees.length === 0;
  const done = g.status === 'confirmed';

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
        ) : done ? (
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
        <ChipRow
          people={g.employees}
          pickedIds={g.pickedEmployees}
          empty="勤務希望が出ていません"
          isProg={isProg}
          disabled={busy || done}
          mark={compare.employees}
          onToggle={onToggleEmployee}
        />
        <UnwantedNote people={g.employees} what="勤務希望" locked={done} mark={compare.employees} />
      </div>

      <div className="mb-xs flex items-baseline gap-xs text-ui-xs font-medium tracking-[0.08em] text-muted">
        <span>受講生徒</span>
        <span className="tnum">
          {picked}名{g.capacity > 0 ? ` ／ 定員 ${g.capacity}名` : ''}
        </span>
      </div>
      <ChipRow
        people={g.students}
        pickedIds={g.pickedStudents}
        empty="受講希望が出ていません"
        isProg={isProg}
        disabled={busy || done}
        mark={compare.students}
        onToggle={onToggleStudent}
      />
      <UnwantedNote people={g.students} what="受講希望" locked={done} mark={compare.students} />

      {g.isOverCapacity ? (
        <p className="mt-sm text-ui-sm text-coral">
          定員を {picked - g.capacity}名 超えています。講師を追加すると定員が伸びます。
        </p>
      ) : null}

      {/* **押せない理由と行き先を必ず書く。** 押しても何も起きないだけだと、
          不具合と読まれるか、押し続けられる */}
      {done ? (
        <p className="mt-sm flex items-start gap-[6px] text-ui-sm text-muted">
          <Icon name="lock" size={14} className="mt-[2px] shrink-0" />
          <span>
            このコマは確定済みです。保護者・講師の画面にもう出ています。
            担当や受講を直すときは<strong className="text-ink">「当日の変更」</strong>から行ってください。
          </span>
        </p>
      ) : null}
    </Card>
  );
}

function ChipRow({ people, pickedIds, empty, isProg, disabled, mark, onToggle }: {
  people: Candidate[];
  pickedIds: string[];
  empty: string;
  isProg: boolean;
  disabled: boolean;
  mark: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-xs">
      {people.length === 0 ? (
        <span className="text-ui-sm text-muted">{empty}</span>
      ) : (
        people.map((p) => (
          <PickChip
            key={p.id}
            person={p}
            picked={pickedIds.includes(p.id)}
            tone={isProg ? 'forest' : 'coral'}
            disabled={disabled}
            mark={mark}
            onClick={() => onToggle(p.id)}
          />
        ))
      )}
    </div>
  );
}

/**
 * 希望を出していないのに割り当てられている人がいることを言葉でも書く。
 * チップの「！」だけだと、記号の意味を毎回思い出させることになる。
 *
 * **戻す場所も書く。** 外すとその人はこの画面の候補から消える（希望を出していない
 * のだから当然だが、押した直後にチップごと消えるので取り返しがつかなく見える）。
 * 実際には「当日の変更」に全講師が候補として並ぶので、そこから足し直せる。
 */
function UnwantedNote({ people, what, locked, mark }: {
  people: Candidate[];
  what: '勤務希望' | '受講希望';
  locked: boolean;
  mark: boolean;
}) {
  const n = mark ? people.filter((p) => !p.wanted).length : 0;
  if (n === 0) return null;
  return (
    <p className="mt-xs text-ui-sm text-muted">
      ！のついた{n}名は{what}を出していません。
      {locked ? '外すときは「当日の変更」から。' : '押すと外せます（戻すときは「当日の変更」から）。'}
    </p>
  );
}

function PickChip({
  person, picked, tone, disabled, mark, onClick,
}: {
  person: Candidate;
  picked: boolean;
  tone: 'forest' | 'coral';
  disabled: boolean;
  mark: boolean;
  onClick: () => void;
}) {
  const solid = tone === 'forest' ? 'bg-forest text-on-dark border-forest' : 'bg-coral text-on-dark border-coral';
  const dashed = tone === 'forest'
    ? 'border-dashed border-forest text-forest bg-canvas'
    : 'border-dashed border-coral text-coral bg-canvas';

  const unwanted = mark && !person.wanted;
  const why = unwanted ? '（希望を出していません）' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={picked}
      /* 押したときに何が起きるかを、色だけでなく言葉でも出す。
         塗りつぶし＝外れる、点線＝入る、は色を見分けられないと伝わらない */
      title={disabled
        ? `${person.name}${why}`
        : `${person.name}${why} を${picked ? '外す' : '仮確定する'}`}
      className={`inline-flex items-center gap-[4px] rounded-pill border px-sm py-[3px] text-ui-sm
        transition-colors disabled:opacity-50 ${picked ? solid : dashed}`}
    >
      {/* 希望を出していない人の目印。**色を変えるだけにしない** ―― 塗りつぶしの
          チップの中で色を足しても、並んだときに違いとして読めない */}
      {unwanted ? <span aria-hidden className="font-medium">！</span> : null}
      {person.name}
    </button>
  );
}
