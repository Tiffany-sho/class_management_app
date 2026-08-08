import { Icon } from './Icon';

interface Props {
  children: string;
  onClick: () => void;
  /** 一覧の行で使うときは太さを落として本文になじませる */
  tone?: 'ink' | 'muted';
  disabled?: boolean;
}

/**
 * 押すと詳細が開く人名。
 *
 * **ただの文字と見分けが付くようにする。** 名前が並んでいる画面で、押せるものと
 * 押せないものが同じ見た目だと、押せることに気づかれないか、押しても何も起きない
 * 名前を何度も押すことになる。矢印を付けているのはそのため。
 */
export function NameLink({ children, onClick, tone = 'ink', disabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${children} の詳細を開く`}
      className={`inline-flex items-center gap-[2px] rounded-sm text-left
        underline decoration-hairline underline-offset-[3px]
        hover:decoration-border-strong disabled:no-underline disabled:opacity-60
        ${tone === 'ink' ? 'text-ink' : 'text-muted'}`}
    >
      {children}
      <Icon name="chevron-right" size={13} className="opacity-60" />
    </button>
  );
}
