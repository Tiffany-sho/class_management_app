import { useEffect, useRef } from 'react';

/**
 * 横スワイプで月を送る。
 *
 * スマホでは ＜＞ を押すより払う方が速いが、**スワイプだけにしない**。
 * 触れる手がかりが無いと操作を見つけられないので、＜＞ のボタンも必ず並べる。
 *
 * 縦に払ったときは無視する。スクロールしようとして月が変わると操作不能に感じる。
 */
export function useSwipeMonth<T extends HTMLElement>(onSwipe: (delta: number) => void) {
  const ref = useRef<T>(null);
  const handler = useRef(onSwipe);
  handler.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let x0: number | null = null;
    let y0 = 0;

    const start = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      x0 = t.clientX;
      y0 = t.clientY;
    };

    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (x0 === null || !t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = null;
      // 横の動きが縦より大きいときだけ拾う
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        handler.current(dx < 0 ? 1 : -1); // 左へ払う = 次の月
      }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
    };
  }, []);

  return ref;
}
