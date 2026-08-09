import type { IconName } from '@/components/ui';
import type { UserRole } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * 管理者のサイドバー。
 * 「申請・承認」は承認して初めて効くものを集めたグループ。
 * 扱う対象は違うが、管理者の動作（見て、承認する）が同じなので同じ場所に置く。
 *
 * アイコンは同じものを2か所で使わない。並んだときに区別が付かなくなるため。
 */
export const ADMIN_NAV: NavGroup[] = [
  { group: 'ホーム', items: [{ to: '/', label: 'ホーム', icon: 'home' }] },
  {
    group: '教室運用',
    items: [
      { to: '/schedule', label: 'スケジュール確定', icon: 'calendar' },
      /* 「これからの月を作る」スケジュール確定と、「もう決まった日を直す」当日の変更は
         別の画面にする。同じ画面にすると、月を組んでいる途中で今日の回を触ってしまい、
         確定済みの勤務実績が意図せず動く。 */
      { to: '/day', label: '当日の変更', icon: 'user-x' },
      { to: '/students', label: '生徒', icon: 'user' },
      { to: '/staff', label: '講師', icon: 'presentation' },
    ],
  },
  {
    group: '申請・承認',
    items: [
      { to: '/overtime', label: '時間外勤務 申請', icon: 'file-check' },
      { to: '/promotion', label: '進級処理', icon: 'graduation' },
    ],
  },
  {
    group: '経営',
    items: [
      /* 月謝は収入・収益から分けてある。あちらは「今月いくら残ったか」を月に一度
         見る画面で、こちらは毎月の入金を1件ずつ記録していく作業。開く回数が違う。 */
      { to: '/fees', label: '月謝', icon: 'yen' },
      { to: '/revenue', label: '収入・収益', icon: 'trending-up' },
      { to: '/payroll', label: '給与計算・締め処理', icon: 'calculator' },
    ],
  },
  {
    group: '連絡',
    items: [
      { to: '/inbox', label: '受信ボックス', icon: 'inbox' },
      { to: '/announcements', label: 'お知らせ', icon: 'megaphone' },
    ],
  },
  {
    group: 'マスタ',
    items: [
      { to: '/master/courses', label: 'コース・料金', icon: 'list' },
      { to: '/master/slots', label: '開催枠', icon: 'clock' },
      { to: '/master/deadlines', label: '締め切り設定', icon: 'hourglass' },
      { to: '/master/users', label: 'ユーザー・招待', icon: 'users' },
    ],
  },
];

/**
 * 保護者・講師のボトムタブ。そのまま iOS のタブ構成になる。
 * タブは5本が上限（超えると "More" に押し込まれて使いにくくなる）。
 */
export const PARENT_TABS: NavItem[] = [
  { to: '/', label: 'ホーム', icon: 'home' },
  { to: '/submit', label: '希望提出', icon: 'calendar' },
  { to: '/plan', label: '予定', icon: 'check-circle' },
  { to: '/news', label: 'お知らせ', icon: 'bell' },
];

export const EMPLOYEE_TABS: NavItem[] = [
  { to: '/', label: '担当', icon: 'users' },
  { to: '/submit', label: '希望提出', icon: 'calendar' },
  { to: '/plan', label: '予定', icon: 'check-circle' },
  { to: '/pay', label: '給与', icon: 'wallet' },
  { to: '/news', label: 'お知らせ', icon: 'bell' },
];

export function tabsFor(role: UserRole): NavItem[] {
  return role === 'employee' ? EMPLOYEE_TABS : PARENT_TABS;
}
