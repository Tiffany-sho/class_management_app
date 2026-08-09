import { supabase } from '../supabase';
import { monthRange } from '../date';
import { fetchBusinessSlots } from './master';
import type { ScheduleSlot, ScheduleStudent, WorkPreference } from '@/types/domain';

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

/* ------------------------------------------------- 希望の提出（保護者・講師） */

/**
 * 受講希望を出す・取り消す。
 *
 * 締め切りを過ぎているか、その月の締め切り行が無ければ **RLS が弾く**。
 * ここで日付を判定しない（画面と DB で判定が二重になり、必ずどちらかがずれる）。
 * 件数の上限は無い（希望は候補で、回数は確定が決める ―― ドメインルール2）。
 * 同じコマの二重登録だけを一意制約が弾く。
 */
export async function addPreference(
  studentId: string, yearMonth: string, sessionDate: string, slotNo: number,
): Promise<void> {
  const { error } = await supabase
    .from('preferences')
    .insert({ student_id: studentId, year_month: yearMonth, session_date: sessionDate, slot_no: slotNo });
  if (error) throw error;
}

export async function removePreference(id: string): Promise<void> {
  const { error } = await supabase.from('preferences').delete().eq('id', id);
  if (error) throw error;
}

export async function addWorkPreference(
  employeeId: string, businessId: string, yearMonth: string, sessionDate: string, slotNo: number,
): Promise<void> {
  const { error } = await supabase.from('work_preferences').insert({
    employee_id: employeeId, business_id: businessId,
    year_month: yearMonth, session_date: sessionDate, slot_no: slotNo,
  });
  if (error) throw error;
}

export async function removeWorkPreference(id: string): Promise<void> {
  const { error } = await supabase.from('work_preferences').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------- 提出したかどうか */

export interface Submitted {
  /** 提出済みの生徒 id */
  students: Set<string>;
  /** 提出済みの講師 id */
  employees: Set<string>;
}

/**
 * その月に希望を提出した人。
 *
 * **希望の件数では判定できない。** 0件で提出できる（「今月は通えない」も伝える
 * 内容 ―― ドメインルール2）ので、0件のとき「まだ出していない」と区別が付かない。
 * 提出した事実は `submissions` の行で持つ（→ migration 20260809130000）。
 */
export async function fetchSubmitted(yearMonth: string): Promise<Submitted> {
  const { data, error } = await supabase
    .from('submissions')
    .select('student_id, employee_id')
    .eq('year_month', yearMonth);
  if (error) throw error;
  return {
    students: new Set((data ?? []).map((s) => s.student_id).filter((x): x is string => Boolean(x))),
    employees: new Set((data ?? []).map((s) => s.employee_id).filter((x): x is string => Boolean(x))),
  };
}

/**
 * 提出を確定する。**これを書いた時点でその月はもう直せない**（RLS が弾く）。
 *
 * 希望の行を書き終えてから最後に呼ぶこと。先に呼ぶと、続く希望の書き込みが
 * 自分で立てた鍵に弾かれる。
 */
export async function markSubmitted(
  yearMonth: string, subject: { studentIds?: string[]; employeeId?: string },
): Promise<void> {
  const rows = [
    ...(subject.studentIds ?? []).map((id) => ({ year_month: yearMonth, student_id: id })),
    ...(subject.employeeId ? [{ year_month: yearMonth, employee_id: subject.employeeId }] : []),
  ];
  if (rows.length === 0) return;
  const { error } = await supabase.from('submissions').insert(rows);
  if (error) throw error;
}

/** 管理者だけ。取り消すとその月はまた提出できる（間違えて出した人を助ける唯一の口） */
export async function unlockSubmission(
  yearMonth: string, subject: { studentId?: string; employeeId?: string },
): Promise<void> {
  let q = supabase.from('submissions').delete().eq('year_month', yearMonth);
  q = subject.studentId
    ? q.eq('student_id', subject.studentId)
    : q.eq('employee_id', subject.employeeId ?? '');
  const { error } = await q;
  if (error) throw error;
}

/** 出席の記録。授業記録（note）と同じ行なので、片方だけ直すことにならない */
export async function setAttendance(
  scheduleId: string, studentId: string, status: 'present' | 'absent' | 'late' | null,
): Promise<void> {
  const { error } = await supabase
    .from('schedule_students')
    .update({ attendance_status: status })
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId);
  if (error) throw error;
}

/**
 * 授業記録。欠席の回に記録は付かない（DB のトリガーが note を落とす）ので、
 * 画面側でも欠席のときは入力させないこと。
 */
export async function setLessonNote(
  scheduleId: string, studentId: string, note: string,
): Promise<void> {
  const { error } = await supabase
    .from('schedule_students')
    .update({ note: note.trim() || null })
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId);
  if (error) throw error;
}
