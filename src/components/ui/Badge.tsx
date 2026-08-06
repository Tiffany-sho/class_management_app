import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'success' | 'danger' | 'warn' | 'prog' | 'illust' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-strong text-muted',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-coral',
  warn: 'bg-cream text-[#7a5c1e]',
  prog: 'bg-prog-tint text-forest',
  illust: 'bg-illust-tint text-coral',
  info: 'bg-[#e8eefb] text-info',
};

/** 状態は色だけで表さない。必ず文字を入れること（色覚と隣接面の見分けのため） */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-pill px-xs py-[2px] text-[11px] font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}
