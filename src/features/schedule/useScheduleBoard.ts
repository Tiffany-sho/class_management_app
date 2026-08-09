import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchBusinesses, fetchScheduleMonth, fetchPreferences, fetchWorkPreferences,
  fetchEmployees, fetchStudents,
} from '@/lib/queries';
import type { DaySummary } from './DayCard';

/**
 * カードのチップに出す1人。
 *
 * **希望を出した人だけでなく、割り当てられている人も必ず入れる。**
 * 以前は希望を出した人だけをチップにし、それ以外は人数だけ添えていたが、
 * **希望を出していないのに割り当てられている人を外す手段が画面に無かった。**
 * 実際に「講師を全部外したのに、外せないコマだけが残って確定された」事故が起きた
 * （山本えみ / 2026-09。希望を出した日は外せて、出していない 9/12・9/20 が残った）。
 */
export interface Candidate {
  id: string;
  name: string;
  /** 希望を出しているか。false = 希望を出していないのに割り当てられている人 */
  wanted: boolean;
}

/** 1コマぶんの「希望」と「仮確定」を束ねたもの */
export interface SlotGroup {
  key: string;
  businessId: string;
  sessionDate: string;
  slotNo: number;
  /** まだコマの行が無いこともある（希望だけ出ている状態）。押したときに作る */
  scheduleId: string | null;
  status: 'draft' | 'confirmed';
  /** チップに出す人。希望を出した人＋割り当てられている人（→ Candidate） */
  students: Candidate[];
  employees: Candidate[];
  pickedStudents: string[];
  pickedEmployees: string[];
  capacity: number;
  isOverCapacity: boolean;
}

function blank(key: string, businessId: string, sessionDate: string, slotNo: number): SlotGroup {
  return {
    key, businessId, sessionDate, slotNo,
    scheduleId: null, status: 'draft',
    students: [], employees: [], pickedStudents: [], pickedEmployees: [],
    capacity: 0, isOverCapacity: false,
  };
}

/**
 * スケジュール確定に出すデータ。
 *
 * 希望（preferences / work_preferences）と仮確定（schedules）は別のテーブルだが、
 * 画面では**同じコマの2つの状態**として1枚のカードに出す。ここで束ねる。
 *
 * 日ごとの要約も一緒に返す。**カードだけ見て「どの日を直すか」が決まるように**、
 * 担当未定と定員超過の件数を数えておく。
 */
export function useScheduleBoard(month: string, bizFilter: string) {
  const state = useAsync(
    async () => {
      const [businesses, slots, prefs, workPrefs, employees, students] = await Promise.all([
        fetchBusinesses(),
        fetchScheduleMonth(month),
        fetchPreferences(month),
        fetchWorkPreferences(month),
        fetchEmployees(),
        fetchStudents(),
      ]);
      return { businesses, slots, prefs, workPrefs, employees, students };
    },
    [month],
  );

  const groups = useMemo<SlotGroup[]>(() => {
    const d = state.data;
    if (!d) return [];

    const map = new Map<string, SlotGroup>();
    const keyOf = (b: string, date: string, no: number) => `${b}|${date}|${no}`;

    for (const p of d.prefs) {
      const k = keyOf(p.businessId, p.sessionDate, p.slotNo);
      const g = map.get(k) ?? blank(k, p.businessId, p.sessionDate, p.slotNo);
      g.students.push({ id: p.studentId, name: p.studentName, wanted: true });
      map.set(k, g);
    }
    for (const w of d.workPrefs) {
      const k = keyOf(w.businessId, w.sessionDate, w.slotNo);
      const g = map.get(k) ?? blank(k, w.businessId, w.sessionDate, w.slotNo);
      g.employees.push({ id: w.employeeId, name: w.employeeName ?? '—', wanted: true });
      map.set(k, g);
    }
    for (const s of d.slots) {
      const k = keyOf(s.businessId, s.sessionDate, s.slotNo);
      const g = map.get(k) ?? blank(k, s.businessId, s.sessionDate, s.slotNo);
      g.scheduleId = s.id;
      g.status = s.status;
      g.pickedStudents = s.students.map((x) => x.studentId);
      g.pickedEmployees = s.employees.map((x) => x.id);
      g.capacity = s.capacity;
      g.isOverCapacity = s.isOverCapacity;
      /* **割り当てられている人は、希望を出していなくても必ずチップにする。**
         希望を出した人だけを出していたころは、そうでない人を外す手段が
         画面のどこにも無かった（人数だけが増えて見える）。
         希望は後から取り消せるし、管理者が当日の変更で足すこともあるので、
         「割り当てはあるが希望は無い」は普通に起きる状態。 */
      for (const st of s.students) {
        if (!g.students.some((x) => x.id === st.studentId)) {
          g.students.push({ id: st.studentId, name: st.studentName, wanted: false });
        }
      }
      for (const e of s.employees) {
        if (!g.employees.some((x) => x.id === e.id)) {
          g.employees.push({ id: e.id, name: e.name, wanted: false });
        }
      }
      map.set(k, g);
    }

    return [...map.values()]
      .filter((g) => bizFilter === 'all' || g.businessId === bizFilter)
      .sort((a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo
        || a.businessId.localeCompare(b.businessId));
  }, [state.data, bizFilter]);

  const days = useMemo<DaySummary[]>(() => {
    const m = new Map<string, DaySummary>();
    for (const g of groups) {
      const cur = m.get(g.sessionDate) ?? {
        date: g.sessionDate, total: 0, confirmed: 0,
        noEmployee: 0, overCapacity: 0, byBusiness: [],
      };
      cur.total += 1;
      if (g.status === 'confirmed') cur.confirmed += 1;
      // 生徒がいないコマの「担当未定」は問題ではない（SlotCard の判定と揃える）
      if (g.pickedStudents.length > 0 && g.pickedEmployees.length === 0) cur.noEmployee += 1;
      if (g.isOverCapacity) cur.overCapacity += 1;
      const b = cur.byBusiness.find((x) => x.businessId === g.businessId);
      if (b) b.count += 1;
      else cur.byBusiness.push({ businessId: g.businessId, count: 1 });
      m.set(g.sessionDate, cur);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [groups]);

  /**
   * 「希望と突き合わせられるか」。
   *
   * **その月に希望が1件も出ていなければ、「希望を出していない」は何も言っていない。**
   * 済んだ月は希望のデータが無いことがあり、そこで全員に！を付けると、
   * 直しようのない印だけが並ぶ（実際、確定済みの月で全チップが！になった）。
   * 比べる相手があるときだけ印を付ける。
   */
  const compare = useMemo(
    () => ({
      students: (state.data?.prefs.length ?? 0) > 0,
      employees: (state.data?.workPrefs.length ?? 0) > 0,
    }),
    [state.data],
  );

  return { state, groups, days, compare };
}
