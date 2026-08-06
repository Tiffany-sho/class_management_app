import type { ReactNode } from 'react';

/** 読み込み中。高さを持たせて、出たり消えたりで表がガタつかないようにする */
export function Loading({ label = '読み込んでいます…' }: { label?: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center gap-sm text-[13px] text-muted">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-pill border-2 border-hairline border-t-primary"
      />
      <span role="status">{label}</span>
    </div>
  );
}

/**
 * 0件。「無い」のか「まだ作っていない」のかを必ず言い分ける。
 * 空欄だけ出すと、壊れているのか空なのか分からない。
 */
export function Empty({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-xs px-lg py-xl text-center">
      <p className="text-[14px] text-ink">{title}</p>
      {hint ? <p className="max-w-[420px] text-[13px] text-muted">{hint}</p> : null}
      {action ? <div className="mt-xs">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-sm rounded-md border border-[#e8d9bb] bg-cream px-md py-sm text-[13px]">
      <span aria-hidden>⚠</span>
      <div className="flex-1">
        <p className="text-ink">{message}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-xs text-link underline">
            もう一度試す
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 補足の帯。クリーム色は「読んでほしいが警告ではない」もの */
export function Note({ icon = '💡', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="mb-md flex items-start gap-sm rounded-md border border-[#e8d9bb] bg-cream px-md py-sm text-[13px] leading-relaxed">
      <span aria-hidden>{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
