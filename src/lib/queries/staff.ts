import { supabase } from '../supabase';
import { todayIso } from '../date';
import type { MonthlyPay, StaffMember, WageRate } from '@/types/domain';

/**
 * 講師まわり。
 *
 * 金額はどこにも保存されていない（ドメインルール11）。
 * 締める前は確定したコマから毎回計算され、締めた後は payrolls の値が正になる。
 * その切り替えは DB のビュー employee_monthly_pay が行うので、ここでは足し算をしない。
 */

/** ビューの列は生成される型で nullable になるが、実体は必ず入っている */
type WorkSlotRow = {
  employee_id: string;
  business_id: string;
  session_date: string;
  year_month: string;
  hours: number;
  amount: number;
};

type MonthlyPayRow = {
  employee_id: string;
  year_month: string;
  status: 'draft' | 'confirmed';
  work_days: number;
  work_hours: number;
  slots: number;
  base_amount: number;
  commute: number;
  overtime: number;
  total: number;
  confirmed_at: string | null;
};

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, active, employee_businesses ( business_id )')
    .eq('role', 'employee')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    active: u.active,
    businessIds: (u.employee_businesses ?? []).map(
      (b: { business_id: string }) => b.business_id,
    ),
  }));
}

/**
 * 講師一覧 + 現在の時給・交通費 + 指定月の担当実績。
 *
 * 時給と交通費は「適用開始日つき」で履歴を持つ（昇給しても過去分が動かないように）。
 * ここでは**今日の時点で適用されているもの**だけを見せる。過去分の再計算に使ってはいけない。
 */
export async function fetchStaff(yearMonth: string): Promise<StaffMember[]> {
  const today = todayIso();

  const [employees, wages, commutes, slots] = await Promise.all([
    fetchEmployees(),
    supabase
      .from('wage_rates')
      .select('employee_id, business_id, job_label, hourly_rate, effective_from')
      .lte('effective_from', today)
      .order('effective_from', { ascending: false }),
    supabase
      .from('commute_allowances')
      .select('employee_id, daily_amount, effective_from')
      .lte('effective_from', today)
      .order('effective_from', { ascending: false }),
    supabase
      .from('employee_work_slots')
      .select('employee_id, business_id, session_date, year_month, hours, amount')
      .eq('year_month', yearMonth),
  ]);

  if (wages.error) throw wages.error;
  if (commutes.error) throw commutes.error;
  if (slots.error) throw slots.error;

  /* effective_from の降順で来るので、最初に見つかったものが「現在適用中」。
     一意制約が (employee_id, business_id, effective_from) なので、
     同じ事業に複数の業務名を持たせることはできない。キーに job_label は入れない。 */
  const wageMap = new Map<string, WageRate[]>();
  const seenWage = new Set<string>();
  for (const w of wages.data ?? []) {
    const key = `${w.employee_id}|${w.business_id}`;
    if (seenWage.has(key)) continue;
    seenWage.add(key);
    const list = wageMap.get(w.employee_id) ?? [];
    list.push({
      businessId: w.business_id,
      jobLabel: w.job_label,
      hourlyRate: w.hourly_rate,
      effectiveFrom: w.effective_from,
    });
    wageMap.set(w.employee_id, list);
  }

  const commuteMap = new Map<string, number>();
  for (const c of commutes.data ?? []) {
    if (!commuteMap.has(c.employee_id)) commuteMap.set(c.employee_id, c.daily_amount);
  }

  const work = new Map<string, { slots: number; hours: number; days: Set<string> }>();
  for (const s of (slots.data ?? []) as WorkSlotRow[]) {
    const cur = work.get(s.employee_id) ?? { slots: 0, hours: 0, days: new Set<string>() };
    cur.slots += 1;
    cur.hours += Number(s.hours);
    cur.days.add(s.session_date);
    work.set(s.employee_id, cur);
  }

  return employees.map((e) => {
    const w = work.get(e.id);
    return {
      ...e,
      wages: wageMap.get(e.id) ?? [],
      commuteDaily: commuteMap.get(e.id) ?? 0,
      monthSlots: w?.slots ?? 0,
      monthHours: Math.round((w?.hours ?? 0) * 10) / 10,
      monthDays: w?.days.size ?? 0,
    };
  });
}

/** 月ごとの支給額。締め前は計算値、確定後は payrolls の値（切り替えはビューの中） */
export async function fetchMonthlyPay(yearMonth: string): Promise<MonthlyPay[]> {
  const { data, error } = await supabase
    .from('employee_monthly_pay')
    .select('employee_id, year_month, status, work_days, work_hours, slots, base_amount, commute, overtime, total, confirmed_at')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return ((data ?? []) as MonthlyPayRow[]).map(toMonthlyPay);
}

/** ある講師の全期間。講師の詳細で「今までの出勤数と給与」を出すのに使う */
export async function fetchEmployeePayHistory(employeeId: string): Promise<MonthlyPay[]> {
  const { data, error } = await supabase
    .from('employee_monthly_pay')
    .select('employee_id, year_month, status, work_days, work_hours, slots, base_amount, commute, overtime, total, confirmed_at')
    .eq('employee_id', employeeId)
    .order('year_month', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MonthlyPayRow[]).map(toMonthlyPay);
}

function toMonthlyPay(p: MonthlyPayRow): MonthlyPay {
  return {
    employeeId: p.employee_id,
    yearMonth: p.year_month,
    status: p.status,
    workDays: p.work_days,
    workHours: Number(p.work_hours),
    slots: p.slots,
    baseAmount: p.base_amount,
    commute: p.commute,
    overtime: p.overtime,
    total: p.total,
    confirmedAt: p.confirmed_at,
  };
}
