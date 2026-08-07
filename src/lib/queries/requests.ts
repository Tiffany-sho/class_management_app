import { supabase } from '../supabase';
import type { AbsenceReport, OvertimeRequest, PromotionCandidate } from '@/types/domain';

/**
 * 申請・連絡まわり（時間外勤務 / 欠席連絡 / 進級）。
 *
 * どれも「見つけて、管理者が承認して初めて効く」もの。
 * **検出と適用を分ける**のが共通の設計で、自動では何も変えない。
 */

/** 決裁者を記録するために自分の id が要る。getSession はローカルを読むだけで通信しない */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/* ---------------------------------------------------------------- 時間外勤務 */

export async function fetchOvertimeRequests(): Promise<OvertimeRequest[]> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(`
      id, employee_id, business_id, work_date, description, hours, status, decided_at,
      users:employee_id ( name ),
      businesses:business_id ( name ),
      decider:decided_by ( name )
    `)
    .order('work_date', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];

  /* 加算額は「その勤務日に適用されていた時給」で決まる。
     承認する人が金額を見ずに判断することになるので、必ず一緒に出す。
     employee_monthly_pay も同じ引き方をしているため、数字は一致する。 */
  const rates = await fetchWageRates(rows.map((o) => o.employee_id));

  return rows.map((o) => {
    const u = o.users as unknown as { name: string } | null;
    const b = o.businesses as unknown as { name: string } | null;
    const d = o.decider as unknown as { name: string } | null;
    const hours = Number(o.hours);
    const hourlyRate = rateAt(rates, o.employee_id, o.business_id, o.work_date);
    return {
      id: o.id,
      employeeId: o.employee_id,
      employeeName: u?.name ?? '—',
      businessId: o.business_id,
      businessName: b?.name ?? '—',
      workDate: o.work_date,
      description: o.description,
      hours,
      hourlyRate,
      amount: Math.round(hours * hourlyRate),
      status: o.status,
      decidedAt: o.decided_at,
      decidedByName: d?.name ?? null,
    };
  });
}

interface RateRow { employeeId: string; businessId: string; from: string; rate: number }

async function fetchWageRates(employeeIds: string[]): Promise<RateRow[]> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('wage_rates')
    .select('employee_id, business_id, hourly_rate, effective_from')
    .in('employee_id', ids)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w) => ({
    employeeId: w.employee_id,
    businessId: w.business_id,
    from: w.effective_from,
    rate: w.hourly_rate,
  }));
}

/** その日に適用されていた時給。降順で並んでいるので最初に見つかったものが正しい */
function rateAt(rates: RateRow[], employeeId: string, businessId: string, on: string): number {
  const hit = rates.find(
    (r) => r.employeeId === employeeId && r.businessId === businessId && r.from <= on,
  );
  return hit?.rate ?? 0;
}

/**
 * 承認・却下。
 * 承認した分だけが給与に乗る（employee_monthly_pay が status='approved' だけを見る）。
 * 割増は付かない。法定残業とは別物。
 */
export async function decideOvertime(id: string, approve: boolean): Promise<void> {
  const { error } = await supabase
    .from('overtime_requests')
    .update({
      status: approve ? 'approved' : 'rejected',
      decided_by: await currentUserId(),
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- 欠席連絡 */

export async function fetchAbsenceReports(): Promise<AbsenceReport[]> {
  const { data, error } = await supabase
    .from('absence_reports')
    .select(`
      id, student_id, schedule_id, reason, created_at, handled_at,
      students:student_id ( name ),
      schedules:schedule_id ( session_date, slot_no, business_id )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => {
    const s = a.students as unknown as { name: string } | null;
    const sc = a.schedules as unknown as
      { session_date: string; slot_no: number; business_id: string } | null;
    return {
      id: a.id,
      studentId: a.student_id,
      studentName: s?.name ?? '—',
      scheduleId: a.schedule_id,
      sessionDate: sc?.session_date ?? null,
      slotNo: sc?.slot_no ?? null,
      businessId: sc?.business_id ?? null,
      reason: a.reason,
      createdAt: a.created_at,
      handledAt: a.handled_at,
    };
  });
}

/** 確認済みにする。ここを押すまで「未確認」として要対応に残り続ける */
export async function markAbsenceHandled(id: string): Promise<void> {
  const { error } = await supabase
    .from('absence_reports')
    .update({ handled_at: new Date().toISOString(), handled_by: await currentUserId() })
    .eq('id', id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- 進級 */

/** ビューの列は生成される型で nullable になる。実体は students との内部結合 */
type PromotionRow = {
  student_id: string;
  name: string;
  business_id: string;
  grade: number;
  current_course_id: string;
  current_grade_label: string;
  sessions_per_month: number;
  current_fee: number;
  suggested_course_id: string | null;
  suggested_grade_label: string | null;
  suggested_fee: number | null;
  fee_diff: number | null;
};

/**
 * 進級でコース変更が必要な生徒。**検出だけ**で、ここでは何も変えない。
 * 承認なしに料金が変わると、保護者に知らせないまま請求額が動いてしまう。
 */
export async function fetchPromotionCandidates(): Promise<PromotionCandidate[]> {
  const { data, error } = await supabase
    .from('students_needing_course_change')
    .select('student_id, name, business_id, grade, current_course_id, current_grade_label, sessions_per_month, current_fee, suggested_course_id, suggested_grade_label, suggested_fee, fee_diff')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as PromotionRow[]).map((p) => ({
    studentId: p.student_id,
    studentName: p.name,
    businessId: p.business_id,
    grade: p.grade,
    currentCourseId: p.current_course_id,
    currentGradeLabel: p.current_grade_label,
    sessionsPerMonth: p.sessions_per_month,
    currentFee: p.current_fee,
    suggestedCourseId: p.suggested_course_id,
    suggestedGradeLabel: p.suggested_grade_label,
    suggestedFee: p.suggested_fee,
    feeDiff: p.fee_diff,
  }));
}

/**
 * 進級を適用する。
 * 過去に発行済みの fees は動かさない（fees.amount はコピーで持っている）。
 * 変わるのは次に生成される月から。
 */
export async function applyPromotion(studentId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ course_id: courseId })
    .eq('id', studentId);
  if (error) throw error;
}

/* ---------------------------------------------------------------- 件数（ホームの要対応） */

export async function countPendingOvertime(): Promise<number> {
  const { count, error } = await supabase
    .from('overtime_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export async function countUnhandledAbsences(): Promise<number> {
  const { count, error } = await supabase
    .from('absence_reports')
    .select('id', { count: 'exact', head: true })
    .is('handled_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function countPromotionCandidates(): Promise<number> {
  const { count, error } = await supabase
    .from('students_needing_course_change')
    .select('student_id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}
