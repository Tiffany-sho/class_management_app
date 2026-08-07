/**
 * アプリが扱う型。
 *
 * ★ DB の行そのものの型（src/types/database.ts）は
 *   `npm run gen:types` で自動生成する。**手書きしない。**
 *   スキーマを変えたら必ず流し直すこと。
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

/* ---------------------------------------------------------------- 講師 */

/** 時給は「講師 × 事業 × 業務」ごとに、適用開始日つきで持つ（昇給しても過去分が動かない） */
export interface WageRate {
  businessId: string;
  jobLabel: string;
  hourlyRate: number;
  effectiveFrom: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  active: boolean;
  businessIds: string[];
  /** 今日の時点で適用中のものだけ。過去分の再計算に使ってはいけない */
  wages: WageRate[];
  commuteDaily: number;
  /** 指定月の担当実績。確定したコマだけが実績になる */
  monthSlots: number;
  monthHours: number;
  monthDays: number;
}

/* ---------------------------------------------------------------- 申請・連絡 */

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  businessId: string;
  businessName: string;
  workDate: string;
  description: string;
  hours: number;
  /** 勤務日に適用されていた時給と、その加算額。割増は付かない（法定残業とは別物） */
  hourlyRate: number;
  amount: number;
  status: RequestStatus;
  decidedAt: string | null;
  decidedByName: string | null;
}

export interface AbsenceReport {
  id: string;
  studentId: string;
  studentName: string;
  scheduleId: string | null;
  sessionDate: string | null;
  slotNo: number | null;
  businessId: string | null;
  reason: string | null;
  createdAt: string;
  /** null = 管理者が未確認。受信ボックスの「要対応」に残り続ける */
  handledAt: string | null;
}

/** 進級でコース変更が必要な生徒。検出のみで、適用は承認してから（ドメインルール9） */
export interface PromotionCandidate {
  studentId: string;
  studentName: string;
  businessId: string;
  grade: number;
  currentCourseId: string;
  currentGradeLabel: string;
  sessionsPerMonth: number;
  currentFee: number;
  /** 該当するコースが無い場合は null（中学卒業後など。判断は保留中） */
  suggestedCourseId: string | null;
  suggestedGradeLabel: string | null;
  suggestedFee: number | null;
  feeDiff: number | null;
}

/**
 * お知らせ。`sentAt` が null かつ `scheduledAt` が未来 = 予約中。
 * 予約中のものは RLS が対象者に見せない。
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorName: string;
  /** null = 全ロール */
  targetRole: 'parent' | 'employee' | null;
  /** null = 全事業 */
  businessId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
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
