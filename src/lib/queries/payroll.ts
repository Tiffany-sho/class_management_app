import { supabase } from '../supabase';
import type { MonthlyPay } from '@/types/domain';

/**
 * 給与の計算と締め処理。
 *
 * 金額はどこにも保存されていない（ドメインルール11）。
 * 締める前は確定したコマから毎回計算され、締めた後は payrolls の値が正になる。
 * その切り替えは DB のビュー employee_monthly_pay が行うので、ここでは足し算をしない。
 */

/**
 * ビューの行。
 *
 * 生成される型ではビューの列がすべて nullable になる（PostgreSQL がビューの列に
 * NOT NULL を保証できないため）。実際に null が来るという意味ではない。
 * ビュー定義の join を left join に変えるとこの前提が崩れる。変えるときは必ずここも直す。
 */
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

/** employee_work_slots を、給与の根拠を1件ずつ出すための列で引いたときの行 */
type WorkSlotDetailRow = {
  schedule_id: string;
  business_id: string;
  session_date: string;
  slot_no: number;
  hours: number | string;
  hourly_rate: number;
  amount: number;
};

/** 出勤したコマ1件ぶん。給与の根拠を1行ずつ見せるのに使う */
export interface WorkSlot {
  scheduleId: string;
  businessId: string;
  sessionDate: string;
  slotNo: number;
  hours: number;
  hourlyRate: number;
  amount: number;
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
 * ある講師のその月の出勤コマ。
 *
 * **確定したコマだけが返る**（ビューの where で絞っている）。給与の根拠そのものなので、
 * 画面で足し引きしない。時給もコマの日付時点のものがビューから来る
 * （昇給しても、昇給前のコマは昇給前の時給で出る）。
 */
export async function fetchEmployeeWorkSlots(
  yearMonth: string, employeeId: string,
): Promise<WorkSlot[]> {
  const { data, error } = await supabase
    .from('employee_work_slots')
    .select('schedule_id, business_id, session_date, slot_no, hours, hourly_rate, amount')
    .eq('year_month', yearMonth)
    .eq('employee_id', employeeId)
    .order('session_date')
    .order('slot_no');
  if (error) throw error;
  return ((data ?? []) as WorkSlotDetailRow[]).map((r) => ({
    scheduleId: r.schedule_id,
    businessId: r.business_id,
    sessionDate: r.session_date,
    slotNo: r.slot_no,
    hours: Number(r.hours),
    hourlyRate: r.hourly_rate,
    amount: r.amount,
  }));
}

/**
 * 月を締める。計算値を payrolls にコピーして confirmed にする。
 *
 * **締めた後は時給を変えても金額が動かない**（ビューが payrolls の値を返すようになる）。
 * 確定済みの行は DB のトリガーが更新・削除を拒むので、ここで上書きはできない。
 *
 * `employeeId` を渡すとその1名だけを締める。急な欠勤で出勤が変わった人を後回しにして、
 * 先に確定できる人だけ締められるようにするため。
 */
export async function confirmPayroll(
  yearMonth: string, employeeId?: string,
): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  const adminId = session.session?.user.id ?? null;

  const pays = await fetchMonthlyPay(yearMonth);
  const draft = pays.filter(
    (p) => p.status === 'draft' && (!employeeId || p.employeeId === employeeId),
  );
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
