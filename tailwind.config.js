import tokens from './design-tokens.js';

/**
 * デザイントークンは design-tokens.js から読む（DESIGN.md が正本）。
 * iOS 側の tailwind.config.js も同じファイルを同じ形で読むので、
 * ここに色や余白を直接書かないこと。書くと2つのアプリでずれる。
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: tokens.screens,
    extend: {
      colors: {
        ...tokens.colors,
        // 状態の面（確定 / 未確定）。色だけに頼らず必ず文字も添える
        'state-confirmed': tokens.stateSurfaces.confirmed.bg,
        'state-pending': tokens.stateSurfaces.pending.bg,
        'prog-tint': tokens.stateSurfaces.progTint,
        'illust-tint': tokens.stateSurfaces.illustTint,
        'success-tint': tokens.stateSurfaces.successTint,
        'danger-tint': tokens.stateSurfaces.dangerTint,
      },
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
      spacing: tokens.spacing,
      boxShadow: tokens.boxShadow,
    },
  },
  plugins: [],
};
