import { useAuth } from '@/features/auth/AuthProvider';
import { ParentSubmit } from './ParentSubmit';
import { EmployeeSubmit } from './EmployeeSubmit';

/**
 * 希望提出。ロールで中身が入れ替わる。
 *
 * 保護者は受講希望（生徒ごと・回数の上限あり）、講師は勤務希望（上限なし）。
 * 見るものが違うだけで「候補から選んでまとめて出す」構造は同じなので、
 * 選択行（PickRow）と件数の帯（SubmitCounter）は共通のものを使う。
 */
export function SubmitPage() {
  const { role } = useAuth();
  return role === 'employee' ? <EmployeeSubmit /> : <ParentSubmit />;
}
