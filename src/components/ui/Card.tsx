import type { ReactNode } from 'react';

/** 白面の箱。影は最小限（DESIGN.md: 罫線と余白で階層を作り、影に頼らない） */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-md border border-hairline bg-canvas shadow-card ${className}`}>
      {children}
    </div>
  );
}

/**
 * 見出し付きの白面。
 *
 * `description` は**見出しのすぐ下**に置く。「タップで記録されます」のような
 * 操作の説明は、対象から離すと読まれない。
 */
export function Panel({
  title, description, className = '', children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mb-md rounded-md border border-hairline bg-canvas p-lg shadow-card ${className}`}>
      {title ? <h3 className="text-[14px] font-medium text-ink">{title}</h3> : null}
      {description ? (
        <div className="mb-sm mt-[2px] text-[12px] text-muted">{description}</div>
      ) : title ? <div className="mb-sm" /> : null}
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
