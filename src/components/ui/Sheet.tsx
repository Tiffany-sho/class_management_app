import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { lockBodyScroll, pushEscapeHandler } from './overlayStack';

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
 *
 * **背面の固定と Esc は overlayStack で共有する。** シートは重なることがある
 * （日別シートの上に生徒詳細など）ので、各自が「前の値」を覚えて戻す方式だと、
 * 戻す順によって 'hidden' が残り、**シートが無いのにスクロールできなくなる**。
 *
 * `onClose` は**依存配列に入れない**。呼ぶ側はほぼ毎回その場で関数を作るので、
 * 入れると親が再描画するたびに効果が張り直され、固定の状態が余計に揺れる。
 * 最新の関数は ref で拾う。
 */
export function Sheet({ open, title, subtitle, onClose, footer, children }: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const release = lockBodyScroll();
    const pop = pushEscapeHandler(() => onCloseRef.current());
    return () => { pop(); release(); };
  }, [open]);

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
            {subtitle ? <div className="mt-[3px] text-ui-base text-muted">{subtitle}</div> : null}
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
