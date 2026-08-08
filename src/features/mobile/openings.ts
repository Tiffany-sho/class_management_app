import { daysInMonth, parseMonthKey, toISODate, weekdayOf } from '@/lib/date';
import type { BusinessSlot } from '@/types/domain';

export interface Opening {
  date: string;
  weekday: number;
  businessId: string;
  slotNo: number;
  startTime: string;
  endTime: string;
}

/**
 * 対象月の「開催日 × コマ」を作る。
 *
 * 曜日は `business_slots`（マスタ）から引く。**コードに曜日を書かない。**
 * 開催曜日は事業側の都合で変わるので、書いた瞬間に変更のたびデプロイが要る。
 *
 * 希望提出の候補に使う。来月のコマ（`schedules`）はまだ作られていないので、
 * schedules を見に行くと1件も取れない。
 */
export function buildOpenings(month: string, slots: BusinessSlot[]): Opening[] {
  const { year, month: m } = parseMonthKey(month);
  const out: Opening[] = [];
  for (let day = 1; day <= daysInMonth(year, m); day++) {
    const date = toISODate(year, m, day);
    const w = weekdayOf(date);
    for (const s of slots) {
      if (s.weekday !== w) continue;
      out.push({
        date,
        weekday: w,
        businessId: s.businessId,
        slotNo: s.slotNo,
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }
  }
  return out;
}

/** 選択の照合キー。日付とコマ番号だけでは事業をまたいで衝突する */
export function openingKey(o: { businessId: string; date: string; slotNo: number }): string {
  return `${o.businessId}|${o.date}|${o.slotNo}`;
}
