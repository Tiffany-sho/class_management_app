import { useState, type FormEvent } from 'react';
import { Button, Field, TextInput, ErrorNote } from '@/components/ui';
import { useAuth } from './AuthProvider';
import { DemoAccounts } from './DemoAccounts';

/**
 * ログイン。
 * 自己サインアップは無いので「新規登録」は出さない。
 * 代わりに「アカウントは管理者の招待で作られる」ことを明記して、
 * 登録しようとして詰まるのを防ぐ。
 */
export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-soft px-md py-xl">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[440px] rounded-md border border-hairline bg-canvas p-xl shadow-card"
      >
        <div className="mb-lg flex items-center gap-sm">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-title-sm text-on-primary">
            R
          </div>
          <div>
            <h1 className="text-title-sm">R-Tech 管理システム</h1>
            <p className="text-[12px] text-muted">プログラミング教室・イラスト教室</p>
          </div>
        </div>

        {error ? <div className="mb-md"><ErrorNote message={error} /></div> : null}

        <Field label="メールアドレス">
          <TextInput
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="パスワード">
          <TextInput
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? 'ログインしています…' : 'ログイン'}
        </Button>

        <p className="mt-md text-[12px] leading-relaxed text-muted">
          アカウントは<strong className="text-ink">管理者の招待</strong>で作られます。
          ご自身での新規登録はできません。招待メールが届いていない場合は管理者にご連絡ください。
        </p>

        {/* ★ 本番データを入れる前に、この行と DemoAccounts.tsx を消すこと */}
        <DemoAccounts
          onPick={(mail, pw) => { setEmail(mail); setPassword(pw); setError(null); }}
        />
      </form>
    </div>
  );
}
