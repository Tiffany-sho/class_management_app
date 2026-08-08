/**
 * 日付まわり。
 *
 * DB は date 型を 'YYYY-MM-DD' の文字列で返す。これを new Date() に渡すと
 * UTC として解釈され、日本時間では前日にずれる。ここの関数は必ず
 * 文字列を数値に分解して扱い、タイムゾーンを跨がせない。
 */

export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 'YYYY-MM-DD' → [年, 月, 日]。UTC 解釈のずれを避けるため自前で分解する */
export function splitDate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y ?? 0, m ?? 0, d ?? 0];
}

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 曜日番号（0=日）。Zeller ではなくローカル Date を日単位で使う */
export function weekdayOf(iso: string): number {
  const [y, m, d] = splitDate(iso);
  return new Date(y, m - 1, d).getDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 'YYYY-MM' 形式の月キー */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y ?? 0, month: m ?? 1 };
}

export function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const total = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

export function currentMonthKey(today = new Date()): string {
  return monthKey(today.getFullYear(), today.getMonth() + 1);
}

/** その月の1日〜末日を 'YYYY-MM-DD' の範囲で返す（クエリの between に使う） */
export function monthRange(key: string): { from: string; to: string } {
  const { year, month } = parseMonthKey(key);
  return { from: toISODate(year, month, 1), to: toISODate(year, month, daysInMonth(year, month)) };
}

/**
 * 年度（4月始まり）。1〜3月は前年度として扱う。
 * DB の academic_year() と同じ規則。学年の計算に使う。
 */
export function academicYear(at = new Date()): number {
  return at.getMonth() + 1 >= 4 ? at.getFullYear() : at.getFullYear() - 1;
}

/** 小1=1 .. 小6=6、中1=7 .. 中3=9。9 を超えたら中学卒業 */
export function gradeLabel(grade: number): string {
  if (grade < 1) return '未就学';
  if (grade <= 6) return `小${grade}`;
  if (grade <= 9) return `中${grade - 6}`;
  return '卒業';
}

/** '2026-08-09' → '8月9日（日）' */
export function formatDayJa(iso: string): string {
  const [, m, d] = splitDate(iso);
  return `${m}月${d}日（${WEEKDAY_JA[weekdayOf(iso)]}）`;
}

/** '2026-08' → '2026年 8月' */
export function formatMonthJa(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${year}年 ${month}月`;
}

/** 'HH:MM:SS' → 'HH:MM' */
export function formatTime(t: string): string {
  return t.slice(0, 5);
}

/** '13:00:00' + '14:30:00' → '13:00〜14:30' */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}〜${formatTime(end)}`;
}

/**
 * 今日の 'YYYY-MM-DD'。
 * toISOString().slice(0,10) は UTC に直してしまい、日本時間の朝9時より前だと前日になる。
 * ローカルの年月日をそのまま組み立てること。
 */
export function todayIso(today = new Date()): string {
  return toISODate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

export function isPast(iso: string, today = new Date()): boolean {
  return iso < todayIso(today);
}

/** 'YYYY-MM-DD' を日単位で動かす。月をまたぐ計算は Date に任せる（末日の判定を自前で書かない） */
export function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = splitDate(iso);
  const at = new Date(y, m - 1, d + delta);
  return toISODate(at.getFullYear(), at.getMonth() + 1, at.getDate());
}

export function isToday(iso: string, today = new Date()): boolean {
  return iso === todayIso(today);
}

/** 締め切りの残り。締め切り間近を目立たせるために使う */
export function untilLabel(at: string, now = new Date()): string {
  const diff = new Date(at).getTime() - now.getTime();
  if (diff <= 0) return '締切済み';
  const hours = Math.floor(diff / 3600_000);
  if (hours < 1) return `あと${Math.max(1, Math.floor(diff / 60_000))}分`;
  if (hours < 24) return `あと${hours}時間`;
  return `あと${Math.floor(hours / 24)}日`;
}

/**
 * 届いてからの経過。受信ボックスで「いつ来たか」を出すのに使う。
 * 1週間を超えたら相対表記をやめて日付にする（「28日前」は読み取りにくい）。
 */
export function sinceLabel(at: string, now = new Date()): string {
  const diff = now.getTime() - new Date(at).getTime();
  if (diff < 0) return 'たった今';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}日前`;
  const d = new Date(at);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * カレンダーの6週分（42マス）を作る。
 * 前後の月にはみ出したマスは null にして、月の境界を曖昧にしない。
 */
export function calendarCells(key: string): (string | null)[] {
  const { year, month } = parseMonthKey(key);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < 42; i++) {
    const day = i - firstWeekday + 1;
    cells.push(day >= 1 && day <= total ? toISODate(year, month, day) : null);
  }
  return cells;
}
