/**
 * DESIGN.md のトークンを JS オブジェクトにしたもの。
 *
 * ★ このファイルは Web と iOS(NativeWind) の両リポジトリでコピー同期する。
 *   他のコードを絶対に混ぜないこと。混ぜた瞬間にコピー同期ができなくなる。
 *
 * ★ DESIGN.md を変えたら、このファイルと両リポジトリを必ず同時に更新する。
 *   片方だけ直すと、2つのアプリの見た目が少しずつ食い違っていく。
 *
 * 使い方: 各リポジトリの tailwind.config.js の theme.extend でこれを読む。
 */

/** 事業（教室）の色。プログラミング=forest / イラスト=coral で全画面統一する。 */
export const businessColorKeys = {
  prog: 'forest',
  illust: 'coral',
};

export const colors = {
  primary: '#1a2336',
  'primary-active': '#121a29',
  ink: '#181d26',
  body: '#333840',
  muted: '#41454d',
  hairline: '#dddddd',
  'border-strong': '#9297a0',
  canvas: '#ffffff',
  'surface-soft': '#f8fafc',
  'surface-strong': '#e0e2e6',
  'surface-dark': '#1a2336',
  'surface-dark-elevated': '#1d1f25',
  coral: '#a83a3d',
  forest: '#1a5c34',
  cream: '#f5e9d4',
  peach: '#fcab79',
  mint: '#a8d8c4',
  yellow: '#f4d35e',
  mustard: '#d9a441',
  'on-primary': '#ffffff',
  'on-dark': '#ffffff',
  link: '#1b61c9',
  'link-active': '#1a3866',
  info: '#254fad',
  'info-border': '#458fff',
  success: '#006400',
  'success-border': '#39bf45',
  'pricing-ink': '#1d1f25',
};

/**
 * 状態を表す面の色。
 * 確定 / 未確定 のような隣り合う面は、色差 ΔE を 2 以上（できれば 8 以上）
 * 離さないと人間には区別できない。色だけに頼らず必ず文字も添えること。
 */
export const stateSurfaces = {
  confirmed: { bg: '#eef7f1', bar: colors.forest },
  pending: { bg: '#fdeeeb', bar: colors.coral },
  progTint: '#e7efe9',
  illustTint: '#f7e8e8',
  successTint: '#e6f0e6',
  dangerTint: '#f7e8e8',
};

export const fontFamily = {
  sans: [
    '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Inter', 'Roboto',
    '"Helvetica Neue"', '"Hiragino Sans"', '"Noto Sans JP"', 'sans-serif',
  ],
  pricing: ['"Inter Display"', 'system-ui', 'sans-serif'],
};

/** [fontSize, { lineHeight, letterSpacing, fontWeight }] — Tailwind の fontSize 形式 */
export const fontSize = {
  'display-xl': ['48px', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '500' }],
  'display-lg': ['40px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
  'display-md': ['32px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
  'title-lg': ['24px', { lineHeight: '1.35', letterSpacing: '0.12px', fontWeight: '400' }],
  'title-md': ['20px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
  'title-sm': ['18px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
  'label-md': ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
  button: ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
  'body-md': ['14px', { lineHeight: '1.25', letterSpacing: '0', fontWeight: '400' }],
  caption: ['14px', { lineHeight: '1.35', letterSpacing: '0.16px', fontWeight: '500' }],
  legal: ['13.12px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '600' }],
  'pricing-display': ['44.8px', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '475' }],
  'pricing-section': ['28px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '475' }],
  'pricing-card-title': ['20px', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '475' }],
};

export const borderRadius = {
  xs: '2px',
  sm: '6px',
  md: '10px',
  lg: '12px',
  pill: '9999px',
};

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  section: '96px',
};

export const boxShadow = {
  card: '0 1px 2px rgba(24,29,38,.04)',
  raised: '0 2px 8px rgba(24,29,38,.06)',
  sheet: '0 -8px 32px rgba(24,29,38,.16)',
};

/** DESIGN.md の Breakpoints。管理者サイドバーは 900px 未満でドロワーになる。 */
export const screens = {
  sm: '640px',
  md: '768px',
  app: '900px',
  lg: '1100px',
  xl: '1280px',
};

export const tokens = {
  colors,
  stateSurfaces,
  fontFamily,
  fontSize,
  borderRadius,
  spacing,
  boxShadow,
  screens,
  businessColorKeys,
};

export default tokens;
