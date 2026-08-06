import type { AttendanceStatus, BusinessColorKey, FeeStatus } from '@/types/domain';

export function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

/** 事業の色。プログラミング=forest / イラスト=coral（DESIGN.md で固定） */
export function businessTint(key: BusinessColorKey): string {
  return key === 'forest' ? 'bg-prog-tint text-forest' : 'bg-illust-tint text-coral';
}

export function businessDot(key: BusinessColorKey): string {
  return key === 'forest' ? 'bg-forest' : 'bg-coral';
}

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  absent: '欠席',
  late: '遅刻',
};

export const FEE_LABEL: Record<FeeStatus, string> = {
  paid: '支払済',
  unpaid: '未払い',
};

/** 出欠・支払いのバッジ色。色だけに頼らず必ずラベルも一緒に出すこと */
export function attendanceTone(s: AttendanceStatus | null): 'success' | 'danger' | 'neutral' {
  if (s === 'present') return 'success';
  if (s === 'absent') return 'danger';
  return 'neutral'; // 遅刻・未マーク
}

/** 「n名」「n件」のような単位付き。0 のときも「0名」と出す（空欄にしない） */
export function count(n: number, unit = '名'): string {
  return `${n}${unit}`;
}
