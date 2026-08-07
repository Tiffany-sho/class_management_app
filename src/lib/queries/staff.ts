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

/**
 * 時給を設定する。
 *
 * **既存の行は書き換えず、適用開始日つきで新しい行を足す。**
 * 上書きすると、その時給で計算済みの過去の給与までさかのぼって変わってしまう。
 * 同じ日付で出し直したときだけ上書きになる（打ち間違いの訂正）。
 */
export async function setWageRate(
  employeeId: string, businessId: string, jobLabel: string,
  hourlyRate: number, effectiveFrom: string,
): Promise<void> {
  const { error } = await supabase.from('wage_rates').upsert(
    {
      employee_id: employeeId, business_id: businessId, job_label: jobLabel,
      hourly_rate: hourlyRate, effective_from: effectiveFrom,
    },
    { onConflict: 'employee_id,business_id,effective_from' },
  );
  if (error) throw error;
}

/** 交通費も同じ考え方。日額 × 出勤日数で、事業には割り振らない */
export async function setCommuteAllowance(
  employeeId: string, dailyAmount: number, effectiveFrom: string,
): Promise<void> {
  const { error } = await supabase.from('commute_allowances').upsert(
    { employee_id: employeeId, daily_amount: dailyAmount, effective_from: effectiveFrom },
    { onConflict: 'employee_id,effective_from' },
  );
  if (error) throw error;
}

/**
 * 担当できる事業を設定する。
 * 外した事業に既に割り当てられたコマがあると、DB の複合外部キーが削除を止める
 * （過去の勤務実績が消えると給与の根拠が無くなるため）。
 */
export async function setEmployeeBusinesses(
  employeeId: string, businessIds: string[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('employee_businesses')
    .delete()
    .eq('employee_id', employeeId)
    .not('business_id', 'in', `(${businessIds.length ? businessIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
  if (delErr) throw delErr;

  if (businessIds.length === 0) return;
  const { error } = await supabase
    .from('employee_businesses')
    .upsert(
      businessIds.map((business_id) => ({ employee_id: employeeId, business_id })),
      { onConflict: 'employee_id,business_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** 事業ごとのコマ人件費。交通費と時間外は事業に割り振らないので、ここには含めない */
export async function fetchWorkSlotSummary(
  yearMonth: string,
): Promise<Map<string, { slots: number; hours: number; amount: number }>> {
  const { data, error } = await supabase
    .from('employee_work_slots')
    .select('business_id, hours, amount')
    .eq('year_month', yearMonth);
  if (error) throw error;
  const out = new Map<string, { slots: number; hours: number; amount: number }>();
  for (const r of (data ?? []) as { business_id: string; hours: number; amount: number }[]) {
    const cur = out.get(r.business_id) ?? { slots: 0, hours: 0, amount: 0 };
    cur.slots += 1;
    cur.hours += Number(r.hours);
    cur.amount += r.amount;
    out.set(r.business_id, cur);
  }
  return out;
}

/**
 * 月を締める。計算値を payrolls にコピーして confirmed にする。
 *
 * **締めた後は時給を変えても金額が動かない**（ビューが payrolls の値を返すようになる）。
 * 確定済みの行は DB のトリガーが更新・削除を拒むので、ここで上書きはできない。
 */
export async function confirmPayroll(yearMonth: string): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  const adminId = session.session?.user.id ?? null;

  const pays = await fetchMonthlyPay(yearMonth);
  const draft = pays.filter((p) => p.status === 'draft');
  if (draft.length === 0) return 0;

  /* 既に draft の行があれば上書きする。確定済みの行は DB のトリガーが
     更新を拒むので、締め直しはここではなく例外として現れる。 */
  const { error } = await supabase.from('payrolls').upsert(
    draft.map((p) => ({
      employee_id: p.employeeId,
      year_month: p.yearMonth,
      work_days: p.workDays,
      work_hours: p.workHours,
      base_amount: p.baseAmount,
      commute: p.commute,
      overtime: p.overtime,
      total: p.total,
      status: 'confirmed' as const,
      confirmed_at: new Date().toISOString(),
      confirmed_by: adminId,
    })),
    { onConflict: 'employee_id,year_month' },
  );
  if (error) throw error;
  return draft.length;
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
