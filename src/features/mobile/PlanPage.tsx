import { useAuth } from '@/features/auth/AuthProvider';
import { ParentPlan } from './ParentPlan';
import { EmployeePlan } from './EmployeePlan';

/**
 * 予定。ロールで中身が入れ替わる。
 *
 * 保護者は一覧だけ（自分の子の回を上から順に見て、欠席を連絡する）。
 * 講師は月カレンダーが主（日曜は2教室が並行開催されるので、
 * 日単位で見ないと自分がどちらに入っているか分からない）。
 */
export function PlanPage() {
  const { role } = useAuth();
  return role === 'employee' ? <EmployeePlan /> : <ParentPlan />;
}
