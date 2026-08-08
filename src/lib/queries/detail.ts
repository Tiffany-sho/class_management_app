import { supabase } from '../supabase';
import { monthRange } from '../date';
import type { AttendanceStatus } from '@/types/domain';

/**
 * 生徒詳細・講師詳細を **id ひとつから** 引く。
 *
 * どの画面からでも名前を押せば開けるようにするため、呼ぶ側が行データを
 * 揃えて渡す形にしない。**渡せる情報は画面ごとに違う**（スケジュール確定は
 * 名前しか持っていない）ので、揃える前提だと開ける画面が限られる。
 *
 * **絞り込みは書かない。RLS に任せる。** 講師には自分の教室の生徒しか見えず、
 * 月謝は1件も見えない。ここで条件を足すと、DB 側と二重管理になって食い違う。
 */

/* ---------------------------------------------------------------- 生徒 */

export interface StudentDetail {
  id: string;
  name: string;
  businessId: string;
  businessName: string;
  grade: number;
  gradeLabel: string;
  sessionsPerMonth: number;
  monthlyFee: number;
  enrollmentYear: number;
  parentName: string | null;
  history: {
    scheduleId: string;
    sessionDate: string;
    slotNo: number;
    attendanceStatus: AttendanceStatus | null;
    note: string | null;
    notedByName: string | null;
  }[];
  /** 講師には空で返る（fees が RLS で1件も見えない） */
  fees: {
    yearMonth: string;
    amount: number;
    status: 'paid' | 'unpaid';
    paidDate: string | null;
    note: string | null;
  }[];
}

export async function fetchStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const [base, history, fees] = await Promise.all([
    supabase
      .from('students_with_grade')
      .select('id, name, business_id, grade, grade_label, sessions_per_month, monthly_fee, enrollment_year, parent_id, businesses:business_id ( name )')
      .eq('id', studentId)
      .maybeSingle(),
    supabase
      .from('schedule_students')
      .select('schedule_id, attendance_status, note, schedules:schedule_id ( session_date, slot_no ), noted_by_user:noted_by ( name )')
      .eq('student_id', studentId)
      .limit(60),
    /* 講師のときは RLS が 0 件にする。エラーにはならないので分岐は要らない */
    supabase
      .from('fees')
      .select('year_month, amount, status, paid_date, note')
      .eq('student_id', studentId)
      .order('year_month', { ascending: false }),
  ]);

  if (base.error) throw base.error;
  if (history.error) throw history.error;
  if (fees.error) throw fees.error;
  if (!base.data) return null;

  const b = base.data as Record<string, unknown>;
  const biz = b.businesses as { name: string } | null;

  /** 保護者名。講師には users(parent) が1件も見えないので null になる */
  let parentName: string | null = null;
  if (b.parent_id) {
    const { data } = await supabase
      .from('users').select('name').eq('id', b.parent_id as string).maybeSingle();
    parentName = data?.name ?? null;
  }

  return {
    id: b.id as string,
    name: b.name as string,
    businessId: b.business_id as string,
    businessName: biz?.name ?? '—',
    grade: b.grade as number,
    gradeLabel: b.grade_label as string,
    sessionsPerMonth: b.sessions_per_month as number,
    monthlyFee: b.monthly_fee as number,
    enrollmentYear: b.enrollment_year as number,
    parentName,
    history: (history.data ?? [])
      .map((r) => {
        const sc = r.schedules as unknown as { session_date: string; slot_no: number } | null;
        const nb = r.noted_by_user as unknown as { name: string } | null;
        return {
          scheduleId: r.schedule_id,
          sessionDate: sc?.session_date ?? '',
          slotNo: sc?.slot_no ?? 0,
          attendanceStatus: r.attendance_status as AttendanceStatus | null,
          note: r.note,
          notedByName: nb?.name ?? null,
        };
      })
      .filter((r) => r.sessionDate)
      .sort((a, z) => z.sessionDate.localeCompare(a.sessionDate)),
    fees: (fees.data ?? []).map((f) => ({
      yearMonth: f.year_month,
      amount: f.amount,
      status: f.status as 'paid' | 'unpaid',
      paidDate: f.paid_date,
      note: f.note,
    })),
  };
}

/* ---------------------------------------------------------------- 講師 */

export interface StaffDetail {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  businesses: { id: string; name: string }[];
  /** その月に担当しているコマ。他の講師のぶんも RLS 上は見えるので、呼ぶ側で使い分ける */
  slots: {
    scheduleId: string;
    businessId: string;
    sessionDate: string;
    slotNo: number;
    /** 同じコマに入っている他の講師 */
    withNames: string[];
  }[];
}

export async function fetchStaffDetail(
  employeeId: string, yearMonth: string,
): Promise<StaffDetail | null> {
  const { from, to } = monthRange(yearMonth);

  const [user, biz, assigned] = await Promise.all([
    supabase.from('users').select('id, name, email, active').eq('id', employeeId).maybeSingle(),
    supabase
      .from('employee_businesses')
      .select('business_id, businesses:business_id ( id, name )')
      .eq('employee_id', employeeId),
    supabase
      .from('schedule_employees')
      .select('schedule_id, business_id, schedules:schedule_id ( session_date, slot_no )')
      .eq('employee_id', employeeId),
  ]);

  if (user.error) throw user.error;
  if (biz.error) throw biz.error;
  if (assigned.error) throw assigned.error;
  if (!user.data) return null;

  const rows = (assigned.data ?? [])
    .map((r) => {
      const sc = r.schedules as unknown as { session_date: string; slot_no: number } | null;
      return {
        scheduleId: r.schedule_id,
        businessId: r.business_id,
        sessionDate: sc?.session_date ?? '',
        slotNo: sc?.slot_no ?? 0,
      };
    })
    .filter((r) => r.sessionDate >= from && r.sessionDate <= to)
    .sort((a, z) => a.sessionDate.localeCompare(z.sessionDate) || a.slotNo - z.slotNo);

  /* 同じコマの他の講師。「誰と組むか」は当日の段取りに要る */
  const ids = rows.map((r) => r.scheduleId);
  const mates = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('schedule_employees')
      .select('schedule_id, employee_id, users:employee_id ( name )')
      .in('schedule_id', ids);
    if (error) throw error;
    for (const m of data ?? []) {
      if (m.employee_id === employeeId) continue;
      const u = m.users as unknown as { name: string } | null;
      const list = mates.get(m.schedule_id) ?? [];
      list.push(u?.name ?? '—');
      mates.set(m.schedule_id, list);
    }
  }

  return {
    id: user.data.id,
    name: user.data.name,
    email: user.data.email,
    active: user.data.active,
    businesses: (biz.data ?? []).map((r) => {
      const b = r.businesses as unknown as { id: string; name: string } | null;
      return { id: b?.id ?? r.business_id, name: b?.name ?? '—' };
    }),
    slots: rows.map((r) => ({ ...r, withNames: mates.get(r.scheduleId) ?? [] })),
  };
}
