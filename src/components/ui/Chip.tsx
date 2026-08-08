import type { ReactNode } from 'react';

interface Props {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** 絞り込み用。押せるものなので button で出す（span にするとキーボードで届かない） */
export function Chip({ active = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-[6px] rounded-pill border px-sm py-[5px] text-ui-base
        transition-colors
        ${active
          ? 'bg-primary text-on-primary border-primary'
          : 'bg-canvas text-body border-hairline hover:border-border-strong'}`}
    >
      {children}
    </button>
  );
}
