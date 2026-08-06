import type { ReactNode } from 'react';

/** 白面の箱。影は最小限（DESIGN.md: 罫線と余白で階層を作り、影に頼らない） */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-md border border-hairline bg-canvas shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-md border border-hairline bg-canvas p-lg shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** セクション見出し。パネルの上に置く小さいラベル */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-xs text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
      {children}
    </div>
  );
}
