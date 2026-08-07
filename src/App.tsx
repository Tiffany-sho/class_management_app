import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { SetPasswordPage } from './features/auth/SetPasswordPage';
import { NotConfigured } from './features/auth/NotConfigured';
import { AdminLayout } from './components/layout/AdminLayout';
import { MobileLayout } from './components/layout/MobileLayout';
import { Loading, ErrorNote } from './components/ui';
import { AdminHomePage } from './features/home/AdminHomePage';
import { SchedulePage } from './features/schedule/SchedulePage';
import { StudentsPage } from './features/students/StudentsPage';
import { StaffPage } from './features/staff/StaffPage';
import { OvertimePage } from './features/requests/OvertimePage';
import { PromotionPage } from './features/requests/PromotionPage';
import { InboxPage } from './features/inbox/InboxPage';
import { RevenuePage } from './features/revenue/RevenuePage';
import { PayrollPage } from './features/payroll/PayrollPage';
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage';
import { MasterCoursesPage } from './features/master/MasterCoursesPage';
import { MasterSlotsPage } from './features/master/MasterSlotsPage';
import { MasterDeadlinesPage } from './features/master/MasterDeadlinesPage';
import { MasterUsersPage } from './features/master/MasterUsersPage';
import { ParentHomePage } from './features/mobile/ParentHomePage';
import { EmployeeHomePage } from './features/mobile/EmployeeHomePage';
import { SubmitPage } from './features/mobile/SubmitPage';
import { PlanPage } from './features/mobile/PlanPage';
import { EmployeePayPage } from './features/mobile/EmployeePayPage';
import { NewsPage } from './features/mobile/NewsPage';

/**
 * ロールで見せる画面をまるごと切り替える。
 * URL を直接叩かれても、ここで役割ごとのツリーしか組み立てないので
 * 他ロールの画面には到達しない（データ自体は RLS が止める）。
 */
export function App() {
  const { loading, session, user, role, error } = useAuth();
  const location = useLocation();
  const [needsPassword, setNeedsPassword] = useState(false);

  /**
   * 招待リンクは #access_token=...&type=invite で戻ってくる。
   * このときはパスワード未設定なので、設定画面に寄せる。
   */
  useEffect(() => {
    const hash = window.location.hash;
    if (/type=(invite|recovery)/.test(hash)) setNeedsPassword(true);
  }, [location]);

  if (!isConfigured) return <NotConfigured />;
  if (loading) return <div className="grid min-h-full place-items-center"><Loading label="読み込んでいます…" /></div>;

  if (!session) return <LoginPage />;

  if (needsPassword) {
    return <SetPasswordPage onDone={() => { setNeedsPassword(false); window.location.hash = ''; }} />;
  }

  // セッションはあるが public.users が引けない（招待トリガー未実行など）
  if (!user || !role) {
    return (
      <div className="grid min-h-full place-items-center px-md">
        <div className="w-full max-w-[480px]">
          <ErrorNote message={error ?? 'アカウント情報を読み込めませんでした。'} />
        </div>
      </div>
    );
  }

  if (role === 'admin') {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="overtime" element={<OvertimePage />} />
          <Route path="promotion" element={<PromotionPage />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="master/courses" element={<MasterCoursesPage />} />
          <Route path="master/slots" element={<MasterSlotsPage />} />
          <Route path="master/deadlines" element={<MasterDeadlinesPage />} />
          <Route path="master/users" element={<MasterUsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  const title = role === 'employee' ? '担当コマ' : 'マイページ';
  return (
    <Routes>
      <Route element={<MobileLayout title={title} />}>
        <Route index element={role === 'employee' ? <EmployeeHomePage /> : <ParentHomePage />} />
        <Route path="submit" element={<SubmitPage />} />
        <Route path="plan" element={<PlanPage />} />
        {role === 'employee' ? <Route path="pay" element={<EmployeePayPage />} /> : null}
        <Route path="news" element={<NewsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
