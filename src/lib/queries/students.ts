import { supabase } from '../supabase';
import type { Student } from '@/types/domain';

/**
 * students_with_grade ビューの1行。
 *
 * 生成される型ではビューの列がすべて nullable になる。PostgreSQL がビューの列に
 * NOT NULL を保証できないためで、実際に null が来るという意味ではない。
 * このビューは students の NOT NULL 列と courses の**内部結合**なので、
 * ここに挙げた列は必ず値が入る。
 *
 * ビュー定義を left join に変えるとこの前提が崩れる。変えるときは必ずここも直す。
 */
type StudentWithGradeRow = {
  id: string;
  name: string;
  parent_id: string;
  business_id: string;
  course_id: string;
  enrollment_year: number;
  active: boolean;
  grade: number;
  grade_label: string;
  sessions_per_month: number;
  monthly_fee: number;
};

/**
 * 生徒一覧。学年は students_with_grade ビューが毎回計算したものを使う
 * （ドメインルール8。ここで再計算しない）。
 */
export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students_with_grade')
    .select('id, name, parent_id, business_id, course_id, enrollment_year, active, grade, grade_label, sessions_per_month, monthly_fee')
    .eq('active', true)
    .order('name');
  if (error) throw error;

  const rows = (data ?? []) as StudentWithGradeRow[];
  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter(Boolean))];
  const names = await fetchUserNames(parentIds);

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    parentId: s.parent_id,
    parentName: names.get(s.parent_id),
    businessId: s.business_id,
    courseId: s.course_id,
    enrollmentYear: s.enrollment_year,
    grade: s.grade,
    gradeLabel: s.grade_label,
    sessionsPerMonth: s.sessions_per_month,
    monthlyFee: s.monthly_fee,
    active: s.active,
  }));
}

export interface StudentInput {
  name: string;
  parentId: string;
  businessId: string;
  courseId: string;
  /** 小1になった年度。学年はここから毎回計算する（学年は保存しない） */
  enrollmentYear: number;
}

/**
 * 生徒を登録する。
 * 保護者が先に存在している必要がある（アカウントは招待でしか作れないため）。
 * コースは事業のものでないと DB の複合外部キーが弾く。
 */
export async function createStudent(input: StudentInput): Promise<string> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      name: input.name,
      parent_id: input.parentId,
      business_id: input.businessId,
      course_id: input.courseId,
      enrollment_year: input.enrollmentYear,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateStudent(
  id: string, patch: Partial<StudentInput> & { active?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.parentId === undefined ? {} : { parent_id: patch.parentId }),
      ...(patch.businessId === undefined ? {} : { business_id: patch.businessId }),
      ...(patch.courseId === undefined ? {} : { course_id: patch.courseId }),
      ...(patch.enrollmentYear === undefined ? {} : { enrollment_year: patch.enrollmentYear }),
      ...(patch.active === undefined ? {} : { active: patch.active }),
    })
    .eq('id', id);
  if (error) throw error;
}

/** 保護者名など。RLS で見えない id は単に返ってこない（エラーにはしない） */
export async function fetchUserNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('users').select('id, name').in('id', ids);
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

/* ---------------------------------------------------------------- 月謝 */

export interface StudentFee {
  studentId: string;
  amount: number;
  /** 発行時の額。`amount` と違えば管理者が調整した月（→ isAdjusted） */
  baseAmount: number;
  status: 'paid' | 'unpaid';
  paidDate: string | null;
  note: string | null;
}

/**
 * その月の金額が発行時から動いているか。
 *
 * **コースの月額（courses.monthly_fee）と比べてはいけない。** 料金を改定した
 * 瞬間、一度も触っていない過去の全月が「調整された」ことになる。
 * 比べるのは発行時にコピーしておいた `base_amount`（→ migration 20260809120000）。
 */
export function isAdjusted(fee: { amount: number; baseAmount: number }): boolean {
  return fee.amount !== fee.baseAmount;
}

/** 指定月の月謝。行が無い生徒は「まだ請求していない」＝ undefined になる */
export async function fetchFees(yearMonth: string): Promise<Map<string, StudentFee>> {
  const { data, error } = await supabase
    .from('fees')
    .select('student_id, amount, base_amount, status, paid_date, note')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return new Map(
    (data ?? []).map((f) => [
      f.student_id,
      {
        studentId: f.student_id,
        amount: f.amount,
        baseAmount: f.base_amount,
        status: f.status,
        paidDate: f.paid_date,
        note: f.note,
      },
    ]),
  );
}

/**
 * 指定月の月謝を発行する。
 * **既にある行は書き換えない**ので、金額を手で直したあとに実行しても消えない。
 * 発行した額はコピーなので、あとで料金を改定してもこの月は変わらない。
 */
export async function generateFees(yearMonth: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_fees', { p_year_month: yearMonth });
  if (error) throw error;
  return data ?? 0;
}

/**
 * 月謝の1件を直す（入金の記録・金額の調整）。
 *
 * **入金日は渡してもらう。** 「今日」を勝手に入れると、あとから記録したときに
 * 実際の入金日とずれ、通帳と突き合わせられなくなる。
 *
 * 金額を直せるようにしてあるのはドメインルール10（月の途中のコース変更を
 * 日割り計算に寄せず、管理者が手で調整する）のため。**理由は `note` に残す** ――
 * 説明の無い増減は、保護者のマイページにそのまま出て問い合わせになる。
 */
export async function updateFee(
  studentId: string,
  yearMonth: string,
  patch: { status: 'paid' | 'unpaid'; paidDate: string | null; amount: number; note: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('fees')
    .update({
      status: patch.status,
      // 未入金に戻したら入金日も消す（残すと「未払いなのに入金日がある」行になる）
      paid_date: patch.status === 'paid' ? patch.paidDate : null,
      amount: patch.amount,
      note: patch.note,
    })
    .eq('student_id', studentId)
    .eq('year_month', yearMonth);
  if (error) throw error;
}
