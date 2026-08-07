import type { ReactNode } from 'react';

/**
 * 線画アイコン。
 *
 * 絵文字を使わない理由:
 *   - OS とブラウザで形も色も変わる。Windows / iOS / Android で別物になり、
 *     shift_manage_app と見た目を揃えるという前提が崩れる
 *   - 勝手に着色されるので、DESIGN.md の配色の外に出てしまう
 *   - サイズと視覚的な重心が揃わず、並べたときに高さがばらつく
 *
 * すべて 24×24 の枠に stroke（currentColor）で描く。塗りは使わない。
 * 太さ・端の処理をここで一括して決めるため、個々のパスに stroke を書かないこと。
 *
 * **アイコンは必ず装飾**として扱う（aria-hidden 固定）。意味は隣のテキストが持つ。
 * アイコンだけのボタンを作るときは、ボタン側に aria-label を付ける。
 */
export type IconName =
  | 'home' | 'calendar' | 'calendar-check' | 'user' | 'users' | 'presentation'
  | 'file-check' | 'graduation' | 'trending-up' | 'calculator' | 'inbox'
  | 'megaphone' | 'list' | 'clock' | 'hourglass' | 'bell' | 'wallet'
  | 'menu' | 'check' | 'check-circle' | 'chevron-left' | 'chevron-right'
  | 'close' | 'warning' | 'info' | 'lock' | 'note' | 'user-x' | 'search'
  | 'plus' | 'yen';

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3.4 10.8 12 4l8.6 6.8" /><path d="M5.8 9.6V20h12.4V9.6" /><path d="M9.8 20v-5.2h4.4V20" /></>,
  calendar: <><rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.4" /><path d="M3.4 9.8h17.2" /><path d="M8 3.2v3.8M16 3.2v3.8" /></>,
  'calendar-check': <><rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.4" /><path d="M3.4 9.8h17.2" /><path d="M8 3.2v3.8M16 3.2v3.8" /><path d="m8.8 14.6 2.2 2.2 4.2-4.4" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.2c0-3.5 3.2-5.8 7.2-5.8s7.2 2.3 7.2 5.8" /></>,
  users: <><circle cx="9.4" cy="8.2" r="3.3" /><path d="M3 20c0-3.2 2.9-5.4 6.4-5.4s6.4 2.2 6.4 5.4" /><path d="M16.2 5.4a3.3 3.3 0 0 1 0 5.8" /><path d="M17.8 15c2 .7 3.2 2.3 3.2 4.3" /></>,
  presentation: <><rect x="3.4" y="3.6" width="17.2" height="11" rx="2" /><path d="M12 14.6v3.6" /><path d="m8.4 21 3.6-2.8 3.6 2.8" /><path d="m7.6 11.4 2.6-3 2.2 2.2 3.8-4" /></>,
  'file-check': <><path d="M14 3.4H7.6a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h8.8a1.8 1.8 0 0 0 1.8-1.8V7.6z" /><path d="M14 3.4v4.2h4.2" /><path d="m9.4 14.6 1.8 1.8 3.6-3.8" /></>,
  graduation: <><path d="M12 4 2.8 8.2 12 12.4l9.2-4.2z" /><path d="M6.8 10.4v4.4c0 1.7 2.3 3 5.2 3s5.2-1.3 5.2-3v-4.4" /><path d="M21.2 8.2v5.2" /></>,
  'trending-up': <><path d="M3.4 17 9 11.4l3.4 3.4 7.6-7.8" /><path d="M15.4 7h4.6v4.6" /></>,
  calculator: <><rect x="4.6" y="3" width="14.8" height="18" rx="2.2" /><rect x="7.6" y="6" width="8.8" height="3.4" rx="0.8" /><path d="M8 13.2h.01M12 13.2h.01M16 13.2h.01M8 17.2h.01M12 17.2h.01M16 17.2h.01" /></>,
  inbox: <><path d="M3.2 13.6 6 5.6a2 2 0 0 1 1.9-1.4h8.2a2 2 0 0 1 1.9 1.4l2.8 8" /><path d="M3.2 13.6h5l1.2 2.6h5.2l1.2-2.6h5v4.4a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2z" /></>,
  megaphone: <><path d="M3.6 10.4v3.2a1.8 1.8 0 0 0 1.8 1.8h1.4l9.4 4.2V4.4L6.8 8.6H5.4a1.8 1.8 0 0 0-1.8 1.8z" /><path d="M19.4 8.8a4 4 0 0 1 0 6.4" /><path d="M7.8 15.4v4.2" /></>,
  list: <><path d="M9 6.6h11.2M9 12h11.2M9 17.4h11.2" /><path d="M4.4 6.6h.01M4.4 12h.01M4.4 17.4h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7v5.2l3.4 2" /></>,
  hourglass: <><path d="M6.8 3.4h10.4M6.8 20.6h10.4" /><path d="M8.4 3.4v3c0 2 3.6 3.6 3.6 5.6s-3.6 3.6-3.6 5.6v3" /><path d="M15.6 3.4v3c0 2-3.6 3.6-3.6 5.6s3.6 3.6 3.6 5.6v3" /></>,
  bell: <><path d="M18 9.6a6 6 0 1 0-12 0c0 4.8-2 6.2-2 6.2h16s-2-1.4-2-6.2z" /><path d="M13.8 19.4a2.1 2.1 0 0 1-3.6 0" /></>,
  wallet: <><path d="M3.6 7.6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2" /><rect x="3.6" y="7.6" width="16.8" height="12" rx="2.2" /><path d="M16.6 13.6h.01" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  check: <><path d="m4.8 12.6 4.8 4.8L19.2 6.6" /></>,
  'check-circle': <><circle cx="12" cy="12" r="8.6" /><path d="m8.2 12.4 2.6 2.6 5-5.6" /></>,
  'chevron-left': <><path d="m14.4 5.6-6.8 6.4 6.8 6.4" /></>,
  'chevron-right': <><path d="m9.6 5.6 6.8 6.4-6.8 6.4" /></>,
  close: <><path d="m6.2 6.2 11.6 11.6M17.8 6.2 6.2 17.8" /></>,
  warning: <><path d="M12 4.2 2.8 20h18.4z" /><path d="M12 10v4.2" /><path d="M12 17.2h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11.2V16.2" /><path d="M12 8h.01" /></>,
  lock: <><rect x="4.8" y="10.2" width="14.4" height="9.8" rx="2.2" /><path d="M8.2 10.2V7.8a3.8 3.8 0 0 1 7.6 0v2.4" /></>,
  note: <><path d="M4.8 5.4a1.8 1.8 0 0 1 1.8-1.8h7.6l4.8 4.8v10.2a1.8 1.8 0 0 1-1.8 1.8H6.6a1.8 1.8 0 0 1-1.8-1.8z" /><path d="M14.2 3.6v4.8H19" /><path d="M8.4 13h7.2M8.4 16.4h4.6" /></>,
  'user-x': <><circle cx="9.8" cy="8" r="3.4" /><path d="M3.4 20c0-3.2 2.9-5.4 6.4-5.4 1 0 1.9.2 2.7.5" /><path d="m16.2 15.4 4.4 4.4M20.6 15.4l-4.4 4.4" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.2 4.2" /></>,
  plus: <><path d="M12 5.4v13.2M5.4 12h13.2" /></>,
  yen: <><path d="m7.4 5 4.6 6.4L16.6 5" /><path d="M12 11.4V19" /><path d="M7.8 12.6h8.4M7.8 15.6h8.4" /></>,
};

interface Props {
  name: IconName;
  /** px。文字と並べるときは 16〜18、単体のボタンは 20 前後 */
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
