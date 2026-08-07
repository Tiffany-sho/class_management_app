import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * 右から出る詳細パネル（モバイルでは下から）。
 * Esc で閉じられること、開いている間に背面がスクロールしないことを守る。
 */
export function Sheet({ open, title, subtitle, onClose, footer, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[rgba(24,29,38,.34)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-lg bg-canvas
          app:inset-y-0 app:left-auto app:right-0 app:max-h-none app:w-[min(560px,100%)] app:rounded-none
          app:border-l app:border-hairline"
      >
        <div className="flex items-start gap-sm border-b border-hairline px-lg py-md">
          <div className="min-w-0 flex-1">
            <h3 className="text-title-sm">{title}</h3>
            {subtitle ? <div className="mt-[3px] text-[13px] text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-pill border border-hairline
              bg-canvas text-ink hover:border-border-strong"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-lg py-lg">{children}</div>

        {footer ? (
          <div className="flex gap-sm border-t border-hairline px-lg py-md">{footer}</div>
        ) : null}
      </div>
    </>
  );
}
