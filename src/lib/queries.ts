import { supabase } from './supabase';
import { monthRange } from './date';
import type {
  Business, BusinessSlot, Course, Deadline, DeadlineRule,
  ScheduleSlot, ScheduleStudent, Student, WorkPreference,
} from '@/types/domain';

/**
 * DB へのアクセスはすべてここに集める。
 * 画面は snake_case を知らなくて済むように、ここで camelCase に直す。
 *
 * 行の絞り込みは RLS が DB 側で行うので、ここで「自分の子かどうか」等を
 * 条件に足さない。二重に書くと、片方だけ直したときに食い違う。
 */

/* ---------------------------------------------------------------- マスタ */

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

/* ---------------------------------------------------------------- 生徒 */

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

async function fetchUserNames(ids: string[]): Promise<Map<string, string>> {
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

/* ---------------------------------------------------------------- スケジュール */

/**
 * 指定月のコマを、担当講師・受講生徒・定員つきで返す。
 * 定員は schedule_capacity ビューから取る（担当講師数 × 係数を画面で計算しない）。
 *
 * 埋め込みの書き方について:
 * `users:employee_id (...)` のように列名で引けるのは、その列単独の外部キーがある場合だけ。
 * schedule_students → students は複合外部キー (student_id, business_id) で繋がっているため
 * 列名では引けず、制約名 `!schedule_students_student_fk` で指定する必要がある。
 * 列名で書くと実行時に 400（relationship not found）になり、型チェックでは気づけない。
 */
export async function fetchScheduleMonth(yearMonth: string): Promise<ScheduleSlot[]> {
  const { from, to } = monthRange(yearMonth);

  const [schedules, capacity, slots] = await Promise.all([
    supabase
      .from('schedules')
      .select(`
        id, business_id, session_date, slot_no, status,
        schedule_employees ( employee_id, users:employee_id ( id, name ) ),
        schedule_students ( student_id, attendance_status, note, noted_at,
                            students!schedule_students_student_fk ( id, name ),
                            noted_by_user:noted_by ( name ) )
      `)
      .gte('session_date', from)
      .lte('session_date', to)
      .order('session_date')
      .order('slot_no'),
    supabase
      .from('schedule_capacity')
      .select('schedule_id, capacity, is_over_capacity')
      .gte('session_date', from)
      .lte('session_date', to),
    fetchBusinessSlots(),
  ]);

  if (schedules.error) throw schedules.error;
  if (capacity.error) throw capacity.error;

  const capMap = new Map((capacity.data ?? []).map((c) => [c.schedule_id, c]));

  return (schedules.data ?? []).map((s) => {
    const weekday = new Date(`${s.session_date}T00:00:00`).getDay();
    const bs = slots.find(
      (x) => x.businessId === s.business_id && x.slotNo === s.slot_no && x.weekday === weekday,
    );
    const cap = capMap.get(s.id);

    const employees = (s.schedule_employees ?? []).map((e: Record<string, unknown>) => {
      const u = e.users as { id: string; name: string } | null;
      return { id: u?.id ?? String(e.employee_id), name: u?.name ?? '—' };
    });

    const students: ScheduleStudent[] = (s.schedule_students ?? []).map(
      (ss: Record<string, unknown>) => {
        const st = ss.students as { id: string; name: string } | null;
        const nb = ss.noted_by_user as { name: string } | null;
        return {
          studentId: st?.id ?? String(ss.student_id),
          studentName: st?.name ?? '—',
          attendanceStatus: (ss.attendance_status as ScheduleStudent['attendanceStatus']) ?? null,
          note: (ss.note as string | null) ?? null,
          notedAt: (ss.noted_at as string | null) ?? null,
          notedByName: nb?.name ?? null,
        };
      },
    );

    return {
      id: s.id,
      businessId: s.business_id,
      sessionDate: s.session_date,
      slotNo: s.slot_no,
      status: s.status,
      startTime: bs?.startTime ?? '00:00:00',
      endTime: bs?.endTime ?? '00:00:00',
      employees,
      students,
      capacity: cap?.capacity ?? 0,
      isOverCapacity: cap?.is_over_capacity ?? false,
    };
  });
}

/** 提出された受講希望（生徒名つき）。スケジュール確定画面で候補として出す */
export async function fetchPreferences(yearMonth: string) {
  const { data, error } = await supabase
    .from('preferences')
    .select('id, student_id, session_date, slot_no, students:student_id ( id, name, business_id )')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return (data ?? []).map((p) => {
    const s = p.students as unknown as { id: string; name: string; business_id: string } | null;
    return {
      id: p.id,
      studentId: p.student_id,
      studentName: s?.name ?? '—',
      businessId: s?.business_id ?? '',
      sessionDate: p.session_date,
      slotNo: p.slot_no,
    };
  });
}

export async function fetchWorkPreferences(yearMonth: string): Promise<WorkPreference[]> {
  const { data, error } = await supabase
    .from('work_preferences')
    .select('id, employee_id, business_id, year_month, session_date, slot_no, users:employee_id ( name )')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return (data ?? []).map((w) => {
    const u = w.users as unknown as { name: string } | null;
    return {
      id: w.id,
      employeeId: w.employee_id,
      employeeName: u?.name,
      businessId: w.business_id,
      yearMonth: w.year_month,
      sessionDate: w.session_date,
      slotNo: w.slot_no,
    };
  });
}

/** コマが無ければ作る。事業 × 日付 × コマ で一意なので upsert で足りる */
export async function ensureSchedule(
  businessId: string, sessionDate: string, slotNo: number,
): Promise<string> {
  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      { business_id: businessId, session_date: sessionDate, slot_no: slotNo },
      { onConflict: 'business_id,session_date,slot_no', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function toggleScheduleStudent(
  scheduleId: string, businessId: string, studentId: string, assigned: boolean,
): Promise<void> {
  if (assigned) {
    const { error } = await supabase
      .from('schedule_students')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('schedule_students')
      .insert({ schedule_id: scheduleId, student_id: studentId, business_id: businessId });
    if (error) throw error;
  }
}

export async function toggleScheduleEmployee(
  scheduleId: string, businessId: string, employeeId: string, assigned: boolean,
): Promise<void> {
  if (assigned) {
    const { error } = await supabase
      .from('schedule_employees')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('employee_id', employeeId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('schedule_employees')
      .insert({ schedule_id: scheduleId, employee_id: employeeId, business_id: businessId });
    if (error) throw error;
  }
}

/** 月まとめて確定。確定して初めて保護者・講師に表示される */
export async function confirmMonth(yearMonth: string): Promise<number> {
  const { from, to } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'confirmed' })
    .gte('session_date', from)
    .lte('session_date', to)
    .eq('status', 'draft')
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

/* ---------------------------------------------------------------- 締め切り */

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

/* ---------------------------------------------------------------- 講師 */

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

/* ---------------------------------------------------------------- 受信ボックス系 */

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
