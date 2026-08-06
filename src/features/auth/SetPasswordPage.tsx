import { useState, type FormEvent } from 'react';
import { Button, Field, TextInput, ErrorNote, Note } from '@/components/ui';
import { useAuth } from './AuthProvider';

/**
 * 招待メールのリンクから来たときの初回パスワード設定。
 * このとき Supabase は URL のハッシュからセッションを張っているので、
 * ログイン済みの状態で updateUser({ password }) を呼べばよい。
 */
export function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const { setPassword, user, reload } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setError('パスワードは8文字以上にしてください。'); return; }
    if (pw !== pw2) { setError('確認用のパスワードが一致しません。'); return; }

    setBusy(true);
    setError(null);
    const message = await setPassword(pw);
    setBusy(false);
    if (message) { setError(message); return; }
    await reload();
    onDone();
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-soft px-md py-xl">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[400px] rounded-md border border-hairline bg-canvas p-xl shadow-card"
      >
        <h1 className="mb-xs text-title-sm">パスワードの設定</h1>
        <p className="mb-lg text-[13px] text-muted">
          {user?.name ? `${user.name} さん、` : ''}はじめてのログインです。
          パスワードを決めてください。
        </p>

        {error ? <div className="mb-md"><ErrorNote message={error} /></div> : null}

        <Field label="新しいパスワード" hint="8文字以上">
          <TextInput
            type="password"
            required
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <Field label="確認のためもう一度">
          <TextInput
            type="password"
            required
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? '設定しています…' : 'この内容で設定する'}
        </Button>

        <div className="mt-md">
          <Note icon="🔑">
            次回からは、このメールアドレスとパスワードでログインします。
          </Note>
        </div>
      </form>
    </div>
  );
}
