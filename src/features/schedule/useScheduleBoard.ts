import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchBusinesses, fetchScheduleMonth, fetchPreferences, fetchWorkPreferences,
  fetchEmployees, fetchStudents,
} from '@/lib/queries';
import type { DaySummary } from './DayCard';

/** カードに出す候補。**提出された希望だけを出す**（下の hidden* を参照） */
export interface Candidate {
  id: string;
  name: string;
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
  wantStudents: Candidate[];
  wantEmployees: Candidate[];
  pickedStudents: string[];
  pickedEmployees: string[];
  capacity: number;
  isOverCapacity: boolean;
  /**
   * 希望を出していないのに割り当てられている人数。
   *
   * この画面は**提出された希望を確定に変える場所**なので、希望の無い人はチップに出さない。
   * ただし人数と定員は DB の実際の割り当てから来るので、出さないまま黙っていると
   * 「2名と書いてあるのにチップが1つ」になる。数だけ添えて辻褄を合わせる。
   */
  hiddenStudents: number;
  hiddenEmployees: number;
}

function blank(key: string, businessId: string, sessionDate: string, slotNo: number): SlotGroup {
  return {
    key, businessId, sessionDate, slotNo,
    scheduleId: null, status: 'draft',
    wantStudents: [], wantEmployees: [], pickedStudents: [], pickedEmployees: [],
    capacity: 0, isOverCapacity: false,
    hiddenStudents: 0, hiddenEmployees: 0,
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
      g.wantStudents.push({ id: p.studentId, name: p.studentName });
      map.set(k, g);
    }
    for (const w of d.workPrefs) {
      const k = keyOf(w.businessId, w.sessionDate, w.slotNo);
      const g = map.get(k) ?? blank(k, w.businessId, w.sessionDate, w.slotNo);
      g.wantEmployees.push({ id: w.employeeId, name: w.employeeName ?? '—' });
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
      /* 希望を出していない人はチップに出さない（この画面は希望を確定に変える場所）。
         数だけ持って、人数とチップの数が食い違って見えないようにする。 */
      g.hiddenStudents = s.students.filter(
        (st) => !g.wantStudents.some((x) => x.id === st.studentId)).length;
      g.hiddenEmployees = s.employees.filter(
        (e) => !g.wantEmployees.some((x) => x.id === e.id)).length;
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

  return { state, groups, days };
}
