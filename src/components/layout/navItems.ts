import type { UserRole } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * 管理者のサイドバー。
 * 「申請・承認」は承認して初めて効くものを集めたグループ。
 * 扱う対象は違うが、管理者の動作（見て、承認する）が同じなので同じ場所に置く。
 */
export const ADMIN_NAV: NavGroup[] = [
  { group: 'ホーム', items: [{ to: '/', label: 'ホーム', icon: '🏠' }] },
  {
    group: '教室運用',
    items: [
      { to: '/schedule', label: 'スケジュール確定', icon: '🗓' },
      { to: '/students', label: '生徒', icon: '👦' },
      { to: '/staff', label: '講師', icon: '🧑‍🏫' },
    ],
  },
  {
    group: '申請・承認',
    items: [
      { to: '/overtime', label: '時間外勤務 申請', icon: '🏠' },
      { to: '/promotion', label: '進級処理', icon: '🎓' },
    ],
  },
  {
    group: '経営',
    items: [
      { to: '/revenue', label: '収入・収益', icon: '📈' },
      { to: '/payroll', label: '給与計算・締め処理', icon: '🧮' },
    ],
  },
  {
    group: '連絡',
    items: [
      { to: '/inbox', label: '受信ボックス', icon: '🔔' },
      { to: '/announcements', label: 'お知らせ', icon: '📢' },
    ],
  },
  {
    group: 'マスタ',
    items: [
      { to: '/master/courses', label: 'コース・料金', icon: '📋' },
      { to: '/master/slots', label: '開催枠', icon: '⏰' },
      { to: '/master/deadlines', label: '締め切り設定', icon: '⏳' },
      { to: '/master/users', label: 'ユーザー・招待', icon: '👥' },
    ],
  },
];

/**
 * 保護者・講師のボトムタブ。そのまま iOS のタブ構成になる。
 * タブは5本が上限（超えると "More" に押し込まれて使いにくくなる）。
 */
export const PARENT_TABS: NavItem[] = [
  { to: '/', label: 'ホーム', icon: '🏠' },
  { to: '/submit', label: '希望提出', icon: '📅' },
  { to: '/plan', label: '予定', icon: '✓' },
  { to: '/news', label: 'お知らせ', icon: '🔔' },
];

export const EMPLOYEE_TABS: NavItem[] = [
  { to: '/', label: '担当', icon: '👥' },
  { to: '/submit', label: '希望提出', icon: '📅' },
  { to: '/plan', label: '予定', icon: '✓' },
  { to: '/pay', label: '給与', icon: '💴' },
  { to: '/news', label: 'お知らせ', icon: '🔔' },
];

export function tabsFor(role: UserRole): NavItem[] {
  return role === 'employee' ? EMPLOYEE_TABS : PARENT_TABS;
}
