import { Icon } from '@/components/ui';
import type { BusinessColorKey } from '@/types/domain';

interface Props {
  selected: boolean;
  /** 選べない理由がある行。押せないことを opacity だけで伝えない（sub に理由を書く） */
  disabled?: boolean;
  colorKey: BusinessColorKey;
  title: string;
  sub: string;
  /** 事業名の点を出すか。保護者は1教室しか出ないので不要 */
  showDot?: boolean;
  onToggle: () => void;
}

/**
 * 希望提出の候補1行。
 *
 * **押しても即座には保存しない。** 選択は画面の中だけで持ち、
 * まとめて「提出する」で書き込む。1件ずつ書くと、通信が候補の数だけ走り、
 * 途中で切れたときに「どこまで出たか」が分からなくなる。
 */
export function PickRow({
  selected, disabled = false, colorKey, title, sub, showDot = false, onToggle,
}: Props) {
  const isProg = colorKey === 'forest';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`mb-[9px] flex w-full items-center gap-sm rounded-md border px-[14px] py-sm
        text-left transition-colors disabled:opacity-45
        ${selected
          ? isProg
            ? 'border-forest bg-prog-tint'
            : 'border-coral bg-illust-tint'
          : 'border-hairline bg-canvas'}`}
    >
      <span
        aria-hidden
        className={`grid h-[20px] w-[20px] shrink-0 place-items-center rounded-sm border-[1.5px]
          ${selected
            ? isProg
              ? 'border-forest bg-forest text-on-dark'
              : 'border-coral bg-coral text-on-dark'
            : 'border-border-strong'}`}
      >
        {selected ? <Icon name="check" size={13} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[6px] text-ui-md text-ink">
          {showDot ? (
            <span
              aria-hidden
              className={`h-[9px] w-[9px] shrink-0 rounded-pill ${isProg ? 'bg-forest' : 'bg-coral'}`}
            />
          ) : null}
          {title}
        </span>
        <span className="mt-[2px] block text-ui-sm text-muted tnum">{sub}</span>
      </span>
    </button>
  );
}
