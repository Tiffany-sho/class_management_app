import { supabase } from '../supabase';
import { todayIso } from '../date';
import type { StaffMember, WageRate } from '@/types/domain';

/**
 * 講師まわり。担当できる事業・時給・交通費と、月の担当実績。
 *
 * **給与の金額そのものは payroll.ts。** ここで扱うのは単価と、そのもとになる回数まで。
 * 金額はどこにも保存されていない（ドメインルール11）ので、足し算をこちら側に持たない。
 */

/**
 * ビューの行。
 *
 * 生成される型ではビューの列がすべて nullable になる（PostgreSQL がビューの列に
 * NOT NULL を保証できないため）。実際に null が来るという意味ではない。
 * employee_work_slots は schedule_employees → schedules → business_slots の
 * **内部結合**で、時給と金額は `coalesce(..., 0)` を通っているので必ず値が入る。
 *
 * ビュー定義の join を left join に変えるとこの前提が崩れる。変えるときは必ずここも直す。
 */
type WorkSlotRow = {
  employee_id: string;
  business_id: string;
  session_date: string;
  year_month: string;
  hours: number;
  amount: number;
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
