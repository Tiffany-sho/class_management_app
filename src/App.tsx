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
import { Placeholder } from './pages/Placeholder';

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
          <Route path="staff" element={<Placeholder title="講師" />} />
          <Route path="overtime" element={<Placeholder title="時間外勤務 申請" />} />
          <Route path="promotion" element={<Placeholder title="進級処理" />} />
          <Route path="revenue" element={<Placeholder title="収入・収益" />} />
          <Route path="payroll" element={<Placeholder title="給与計算・締め処理" />} />
          <Route path="inbox" element={<Placeholder title="受信ボックス" />} />
          <Route path="announcements" element={<Placeholder title="お知らせ" />} />
          <Route path="master/courses" element={<Placeholder title="コース・料金" />} />
          <Route path="master/slots" element={<Placeholder title="開催枠" />} />
          <Route path="master/deadlines" element={<Placeholder title="締め切り設定" />} />
          <Route path="master/users" element={<Placeholder title="ユーザー・招待" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  const title = role === 'employee' ? '担当コマ' : 'マイページ';
  return (
    <Routes>
      <Route element={<MobileLayout title={title} />}>
        <Route index element={<Placeholder title={title} />} />
        <Route path="submit" element={<Placeholder title="希望提出" />} />
        <Route path="plan" element={<Placeholder title="予定" />} />
        {role === 'employee' ? <Route path="pay" element={<Placeholder title="給与" />} /> : null}
        <Route path="news" element={<Placeholder title="お知らせ" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
