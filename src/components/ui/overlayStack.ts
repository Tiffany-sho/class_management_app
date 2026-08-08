/**
 * 重なった overlay（シート）の共有状態。
 *
 * **各シートが「開く前の値」を自分で覚えて戻す方式は、2枚重なると壊れる。**
 * A が開く（前の値=''）→ B が開く（前の値='hidden'）→ 閉じる順や、開いている
 * 途中の再描画で覚え直したかによって、最後に 'hidden' が書き戻される。
 * こうなると**シートが1枚も無いのにページがスクロールできない**。
 * 「たまにスクロールできない」の原因はこれだった。
 *
 * 数を数えて、**0 になったときだけ戻す**。誰が先に閉じても結果が変わらない。
 */

let depth = 0;
let saved = '';

/** 背面のスクロールを止める。返ってきた関数を呼ぶと解除する */
export function lockBodyScroll(): () => void {
  if (depth === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  depth += 1;

  let released = false;
  return () => {
    /* 二重に解除されても数を狂わせない（React は開発時に効果を2回流す） */
    if (released) return;
    released = true;
    depth -= 1;
    if (depth === 0) document.body.style.overflow = saved;
  };
}

/**
 * Esc の宛先。**一番手前の1枚だけ**が受け取る。
 *
 * document に各シートが直接 keydown を張ると、重なっているとき Esc で
 * 全部まとめて閉じてしまう。手前を閉じて奥に戻る、が普通の期待。
 */
const escapeStack: { fn: () => void }[] = [];

export function pushEscapeHandler(fn: () => void): () => void {
  const entry = { fn };
  escapeStack.push(entry);
  if (escapeStack.length === 1) document.addEventListener('keydown', onKeyDown);

  let popped = false;
  return () => {
    if (popped) return;
    popped = true;
    const i = escapeStack.indexOf(entry);
    if (i >= 0) escapeStack.splice(i, 1);
    if (escapeStack.length === 0) document.removeEventListener('keydown', onKeyDown);
  };
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  escapeStack[escapeStack.length - 1]?.fn();
}
