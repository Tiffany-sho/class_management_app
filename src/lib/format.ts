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

/**
 * 「中村 さとし」→「中村」。
 *
 * カレンダーのマスのように**そもそも姓しか入らない幅**のところで使う。
 * 切り詰めて「中村 さ…」にはしない（何の略か分からない省略記号は出さない）。
 */
export function surname(fullName: string): string {
  return fullName.split(/[ 　]/)[0] || fullName;
}

/**
 * 教室名を出すかどうか。
 *
 * **保護者と講師には、自分が関わる教室が1つしかない。** その人の画面に
 * 「プログラミング教室」と書いても、読む前から分かっていることを繰り返すだけで、
 * 本当に読ませたいもの（日付・時間・生徒・出欠）を押しのける。
 *
 * ただし DB は2教室にまたがることを許している（`employee_businesses` は多対多、
 * きょうだいが別の教室に通うこともありうる）。**またがる人にだけ出す。**
 * 「今は誰もまたがっていないから」で消し込むと、またがる人が現れた日に
 * どちらのコマか読めない画面になる。
 */
export function multiBusiness(businessIds: Iterable<string>): boolean {
  return new Set(businessIds).size > 1;
}
