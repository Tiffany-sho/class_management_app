import { supabase } from '../supabase';
import type { Business, BusinessSlot, Course, Deadline, DeadlineRule } from '@/types/domain';

/* ---------------------------------------------------------------- 事業・開催枠・コース */

export async function fetchBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, color_key, students_per_employee, active')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    colorKey: b.color_key === 'forest' ? 'forest' : 'coral',
    studentsPerEmployee: b.students_per_employee,
    active: b.active,
  }));
}

export async function fetchBusinessSlots(): Promise<BusinessSlot[]> {
  const { data, error } = await supabase
    .from('business_slots')
    .select('id, business_id, weekday, slot_no, start_time, end_time, active')
    .eq('active', true)
    .order('weekday')
    .order('slot_no');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    businessId: s.business_id,
    weekday: s.weekday,
    slotNo: s.slot_no,
    startTime: s.start_time,
    endTime: s.end_time,
    active: s.active,
  }));
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, business_id, grade_label, grade_min, grade_max, sessions_per_month, monthly_fee, is_default, sort_order, active')
    .order('business_id')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    businessId: c.business_id,
    gradeLabel: c.grade_label,
    gradeMin: c.grade_min,
    gradeMax: c.grade_max,
    sessionsPerMonth: c.sessions_per_month,
    monthlyFee: c.monthly_fee,
    isDefault: c.is_default,
    sortOrder: c.sort_order,
    active: c.active,
  }));
}

/** 無効なものも含む。マスタ画面は「消えた」と「無効にした」を区別して見せる */
export async function fetchAllBusinessSlots(): Promise<BusinessSlot[]> {
  const { data, error } = await supabase
    .from('business_slots')
    .select('id, business_id, weekday, slot_no, start_time, end_time, active')
    .order('business_id')
    .order('weekday')
    .order('slot_no');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    businessId: s.business_id,
    weekday: s.weekday,
    slotNo: s.slot_no,
    startTime: s.start_time,
    endTime: s.end_time,
    active: s.active,
  }));
}

/**
 * コースの料金・有効フラグを変える。
 * 発行済みの fees は動かない（請求額は発行時にコピーしているため）。
 * 変わるのは次に生成される月から。
 */
export async function updateCourse(
  id: string, patch: { monthlyFee?: number; active?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({
      ...(patch.monthlyFee === undefined ? {} : { monthly_fee: patch.monthlyFee }),
      ...(patch.active === undefined ? {} : { active: patch.active }),
    })
    .eq('id', id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- ユーザー */

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'parent' | 'employee';
  active: boolean;
}

export async function fetchAllUsers(): Promise<ManagedUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, active')
    .order('role')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** 退職・退会は論理削除。行を消すと過去の実績や請求まで消える */
export async function setUserActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ active }).eq('id', id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- 締め切り */

/** 指定月・種別の締め切り。行が無ければ受付が開いていない（null を返す） */
export async function fetchDeadline(
  yearMonth: string, type: 'parent' | 'employee',
): Promise<Deadline | null> {
  const { data, error } = await supabase
    .from('deadlines')
    .select('id, year_month, type, deadline_at, active')
    .eq('year_month', yearMonth)
    .eq('type', type)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    yearMonth: data.year_month,
    type: data.type,
    deadlineAt: data.deadline_at,
    active: data.active,
  };
}

export async function fetchDeadlines(): Promise<Deadline[]> {
  const { data, error } = await supabase
    .from('deadlines')
    .select('id, year_month, type, deadline_at, active')
    .order('year_month', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    yearMonth: d.year_month,
    type: d.type,
    deadlineAt: d.deadline_at,
    active: d.active,
  }));
}

export async function fetchDeadlineRules(): Promise<DeadlineRule[]> {
  const { data, error } = await supabase
    .from('deadline_rules')
    .select('id, type, day_of_month, time_of_day, active');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    dayOfMonth: r.day_of_month,
    timeOfDay: r.time_of_day,
    active: r.active,
  }));
}

/**
 * 締め切りルールの変更。
 * 過去に生成済みの deadlines は動かさない（受付を締めた後で日付が変わると、
 * 締め切りを過ぎたはずの提出が通ってしまう）。次の生成ぶんから効く。
 */
export async function updateDeadlineRule(
  id: string, dayOfMonth: number, timeOfDay: string,
): Promise<void> {
  const { error } = await supabase
    .from('deadline_rules')
    .update({ day_of_month: dayOfMonth, time_of_day: timeOfDay })
    .eq('id', id);
  if (error) throw error;
}
