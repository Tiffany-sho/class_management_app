import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured, toMessage } from '@/lib/supabase';
import type { AppUser, UserRole } from '@/types/domain';

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: AppUser | null;
  /** ロールが取れないうちは画面を出さない。既定値を admin にすると事故る */
  role: UserRole | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setPassword: (password: string) => Promise<string | null>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth は AuthProvider の中でしか使えません');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * public.users から自分の行を引く。
   * auth.users とは別テーブルで、role はこちらにある。
   * 招待時の metadata に role を入れ忘れると parent になるので、
   * 取れた role をそのまま信じてよい（既定値で補わない）。
   */
  const loadUser = useCallback(async (s: Session | null) => {
    if (!s) { setUser(null); return; }
    const { data, error: e } = await supabase
      .from('users')
      .select('id, name, email, role, active')
      .eq('id', s.user.id)
      .maybeSingle();

    if (e) { setError(toMessage(e)); setUser(null); return; }
    if (!data) {
      // auth には居るが public.users に行が無い＝招待トリガーが動いていない
      setError('アカウントの初期設定が終わっていません。管理者に連絡してください。');
      setUser(null);
      return;
    }
    if (!data.active) {
      setError('このアカウントは利用停止されています。');
      setUser(null);
      return;
    }
    setError(null);
    setUser(data as AppUser);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadUser(data.session);
      if (alive) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!alive) return;
      setSession(s);
      await loadUser(s);
      setLoading(false);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    return e ? toMessage(e) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  /** 招待メールのリンクで来たときに初回パスワードを決める */
  const setPassword = useCallback(async (password: string) => {
    const { error: e } = await supabase.auth.updateUser({ password });
    return e ? toMessage(e) : null;
  }, []);

  const reload = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadUser(data.session);
  }, [loadUser]);

  const value = useMemo<AuthState>(
    () => ({
      loading, session, user, role: user?.role ?? null, error,
      signIn, signOut, setPassword, reload,
    }),
    [loading, session, user, error, signIn, signOut, setPassword, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
