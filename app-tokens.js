/**
 * アプリシェル専用のトークン。
 *
 * **DESIGN.md（= design-tokens.js）はマーケティングサイト由来で、サイドバー・
 * 表・バッジ・チップといったアプリ画面の文字サイズを規定していない**（CLAUDE.md）。
 * そこをここで持つ。design-tokens.js には足さない ―― あちらは DESIGN.md が正本で、
 * 勝手に増やすと shift_manage_app と食い違う。
 *
 * ## 画面の文字サイズは clamp で持つ
 *
 * 固定 px だと、スマホで読める大きさに合わせると PC で小さすぎ、PC に合わせると
 * スマホで溢れる。`clamp(最小, 基準 + vw, 最大)` にして、**画面幅に応じて連続的に
 * 変える**。ブレークポイントで段階的に変えると、境界の1px手前と1px先で見た目が
 * 飛ぶうえ、サイズごとに `sm: md: lg:` を並べることになって指定が3倍に増える。
 *
 * rem で書くのは、**利用者がブラウザの標準文字サイズを大きくしている場合に
 * 一緒に大きくなるため**。px 固定にすると、その設定を無視してしまう。
 *
 * 目安（375px のスマホ → 1280px の PC）:
 *   ui-2xs 12→14 / ui-xs 13→15 / ui-sm 14→16 / ui-base 15→17 / ui-md 16→18
 *   ui-lg 18→20 / ui-xl 22→26 / ui-2xl 25→30 / ui-3xl 31→39
 *
 * **一度 11→13 で入れたが、実機で見てスマホが小さいという指摘を受け、
 * 下限を1px ずつ上げた。** 上限も同じだけ上げて、広い画面での伸びしろは残す。
 *
 * **どの段も、置き換え前の固定 px より小さくならないようにしてある。**
 * 「大きくしたのに一部だけ小さくなった」が起きると、直したことにならない。
 */
export const uiFontSize = {
  'ui-2xs':  ['clamp(0.75rem, 0.702rem + 0.213vw, 0.875rem)',    { lineHeight: '1.35' }],
  'ui-xs':   ['clamp(0.8125rem, 0.764rem + 0.213vw, 0.9375rem)', { lineHeight: '1.4' }],
  'ui-sm':   ['clamp(0.875rem, 0.827rem + 0.213vw, 1rem)',       { lineHeight: '1.5' }],
  'ui-base': ['clamp(0.9375rem, 0.889rem + 0.213vw, 1.0625rem)', { lineHeight: '1.55' }],
  'ui-md':   ['clamp(1rem, 0.952rem + 0.213vw, 1.125rem)',       { lineHeight: '1.5' }],
  'ui-lg':   ['clamp(1.125rem, 1.077rem + 0.213vw, 1.25rem)',    { lineHeight: '1.4' }],
  'ui-xl':   ['clamp(1.375rem, 1.278rem + 0.426vw, 1.625rem)',   { lineHeight: '1.3' }],
  'ui-2xl':  ['clamp(1.5625rem, 1.442rem + 0.53vw, 1.875rem)',   { lineHeight: '1.25' }],
  'ui-3xl':  ['clamp(1.9375rem, 1.742rem + 0.85vw, 2.4375rem)',  { lineHeight: '1.15' }],
};

export default { uiFontSize };
