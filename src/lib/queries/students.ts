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
  status: 'paid' | 'unpaid';
  paidDate: string | null;
  note: string | null;
}

/** 指定月の月謝。行が無い生徒は「まだ請求していない」＝ undefined になる */
export async function fetchFees(yearMonth: string): Promise<Map<string, StudentFee>> {
  const { data, error } = await supabase
    .from('fees')
    .select('student_id, amount, status, paid_date, note')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return new Map(
    (data ?? []).map((f) => [
      f.student_id,
      {
        studentId: f.student_id,
        amount: f.amount,
        status: f.status,
        paidDate: f.paid_date,
        note: f.note,
      },
    ]),
  );
}

export async function setFeeStatus(
  studentId: string, yearMonth: string, status: 'paid' | 'unpaid',
): Promise<void> {
  const { error } = await supabase
    .from('fees')
    .update({ status, paid_date: status === 'paid' ? new Date().toISOString().slice(0, 10) : null })
    .eq('student_id', studentId)
    .eq('year_month', yearMonth);
  if (error) throw error;
}
