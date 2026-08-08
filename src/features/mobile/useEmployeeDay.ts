import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchScheduleMonth } from '@/lib/queries';
import { currentMonthKey, shiftMonth, todayIso } from '@/lib/date';
import type { Business, ScheduleSlot } from '@/types/domain';

export interface DaySlot {
  slot: ScheduleSlot;
  business: Business | undefined;
}

/**
 * 講師の「担当」画面に出すもの。
 *
 * **自分が担当するコマだけに絞るのはここ。** RLS は確定したコマを全員に見せる
 * （コマの行そのものには個人情報が無いため）ので、`fetchScheduleMonth` は
 * 担当していない教室のコマも返してくる。絞らずに出すと、他の講師のコマが
 * 自分の担当として並ぶ。
 *
 * 今月と来月をまとめて読む。月をまたぐと「次の担当」が出せなくなるため。
 */
export function useEmployeeDay(meId: string | null) {
  const state = useAsync(async () => {
    const [businesses, thisMonth, nextMonth] = await Promise.all([
      fetchBusinesses(),
      fetchScheduleMonth(currentMonthKey()),
      fetchScheduleMonth(shiftMonth(currentMonthKey(), 1)),
    ]);
    return { businesses, slots: [...thisMonth, ...nextMonth] };
  }, [meId ?? '']);

  return useMemo(() => {
    const d = state.data;
    const bizMap = new Map((d?.businesses ?? []).map((b) => [b.id, b]));
    const mine = (d?.slots ?? [])
      .filter((s) => meId && s.employees.some((e) => e.id === meId))
      .sort((a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo);

    const today = todayIso();

    /* 直近の担当。今日ぶんがあれば今日、無ければ次の予定。
       どちらも無ければ最後に担当した回（画面が空になるより、直前の回を出したほうが
       「記録を書き忘れていないか」を確かめられる） */
    const upcoming = mine.filter((s) => s.sessionDate >= today);
    const next = upcoming[0] ?? mine[mine.length - 1] ?? null;

    /* 同じ日の自分の担当。直近のコマ自身は除く */
    const sameDay = next
      ? mine.filter((s) => s.sessionDate === next.sessionDate && s.id !== next.id)
      : [];

    /* 済んだのに出欠が付いていないコマ。モックには無いが、これが無いと
       休んだ日の記録を後から入れる手段がどこにも無くなる */
    const unrecorded = mine.filter(
      (s) => s.sessionDate < today && s.students.some((x) => !x.attendanceStatus),
    );

    const withBiz = (s: ScheduleSlot): DaySlot => ({ slot: s, business: bizMap.get(s.businessId) });

    return {
      state,
      businesses: d?.businesses ?? [],
      next: next ? withBiz(next) : null,
      sameDay: sameDay.map(withBiz),
      unrecorded: unrecorded.map(withBiz),
      mineCount: mine.length,
    };
  }, [state, meId]);
}
