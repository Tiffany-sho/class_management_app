/**
 * アプリが扱う型。
 *
 * ★ DB の行そのものの型（src/types/database.ts）は
 *   `npm run gen:types` で自動生成する。手書きしない。
 *   生成物は .gitignore に入れてあるので、各自が一度実行すること。
 *
 * ここに書くのは「画面が受け取る形」だけ。join した結果や、
 * 計算して足した値を含むので、DB の行とは一致しない。
 */

export type UserRole = 'admin' | 'parent' | 'employee';
export type ScheduleStatus = 'draft' | 'confirmed';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type FeeStatus = 'unpaid' | 'paid';
export type DeadlineType = 'parent' | 'employee';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

/** 事業の色。プログラミング=forest / イラスト=coral は全画面で固定（DESIGN.md） */
export type BusinessColorKey = 'forest' | 'coral';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface Business {
  id: string;
  name: string;
  colorKey: BusinessColorKey;
  studentsPerEmployee: number;
  active: boolean;
}

export interface BusinessSlot {
  id: string;
  businessId: string;
  weekday: number; // 0=日 .. 6=土
  slotNo: number;
  startTime: string; // 'HH:MM:SS'
  endTime: string;
  active: boolean;
}

export interface Course {
  id: string;
  businessId: string;
  gradeLabel: string;
  gradeMin: number;
  gradeMax: number;
  sessionsPerMonth: number;
  monthlyFee: number;
  isDefault: boolean;
  sortOrder: number;
  active: boolean;
}

/**
 * 生徒。学年は保存されておらず、DB のビュー側で毎回計算された値が入る
 * （ドメインルール8）。ここで再計算しないこと。
 */
export interface Student {
  id: string;
  name: string;
  parentId: string;
  parentName?: string;
  businessId: string;
  courseId: string;
  enrollmentYear: number;
  grade: number;
  gradeLabel: string;
  sessionsPerMonth: number;
  monthlyFee: number;
  active: boolean;
}

export interface Schedule {
  id: string;
  businessId: string;
  sessionDate: string; // 'YYYY-MM-DD'
  slotNo: number;
  status: ScheduleStatus;
}

/** 1コマの中身。定員はビュー schedule_capacity から来る */
export interface ScheduleSlot extends Schedule {
  startTime: string;
  endTime: string;
  employees: { id: string; name: string }[];
  students: ScheduleStudent[];
  capacity: number;
  isOverCapacity: boolean;
}

export interface ScheduleStudent {
  studentId: string;
  studentName: string;
  attendanceStatus: AttendanceStatus | null;
  /** 授業記録。出欠と同じ行にある（別テーブルではない） */
  note: string | null;
  notedAt: string | null;
  notedByName: string | null;
}

export interface Preference {
  id: string;
  studentId: string;
  yearMonth: string;
  sessionDate: string;
  slotNo: number;
}

export interface WorkPreference {
  id: string;
  employeeId: string;
  employeeName?: string;
  businessId: string;
  yearMonth: string;
  sessionDate: string;
  slotNo: number;
}

export interface Fee {
  id: string;
  studentId: string;
  yearMonth: string;
  amount: number;
  status: FeeStatus;
  paidDate: string | null;
  note: string | null;
}

export interface Deadline {
  id: string;
  yearMonth: string;
  type: DeadlineType;
  deadlineAt: string;
  active: boolean;
}

export interface DeadlineRule {
  id: string;
  type: DeadlineType;
  dayOfMonth: number;
  timeOfDay: string;
  active: boolean;
}

/** 締め前は確定コマからの計算値、確定後は payrolls の値（ドメインルール11） */
export interface MonthlyPay {
  employeeId: string;
  yearMonth: string;
  status: 'draft' | 'confirmed';
  workDays: number;
  workHours: number;
  slots: number;
  baseAmount: number;
  commute: number;
  overtime: number;
  total: number;
  confirmedAt: string | null;
}
