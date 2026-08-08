/**
 * .env が未設定のときの画面。
 * 真っ白にすると「壊れている」のか「設定していないだけ」なのか分からないので、
 * 何をすればいいかまで書く。
 */
export function NotConfigured() {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface-soft px-md py-xl">
      <div className="w-full max-w-[560px] rounded-md border border-hairline bg-canvas p-xl shadow-card">
        <h1 className="mb-sm text-title-sm">Supabase の接続先が設定されていません</h1>
        <p className="mb-md text-ui-base leading-relaxed text-muted">
          プロジェクト直下に <code className="rounded-sm bg-surface-strong px-[4px]">.env</code> を作り、
          Supabase の Project Settings → API にある値を入れて、開発サーバーを再起動してください。
        </p>
        <pre className="overflow-x-auto rounded-md bg-surface-dark p-md text-ui-sm leading-relaxed text-on-dark">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>
        <p className="mt-md text-ui-sm leading-relaxed text-muted">
          <strong className="text-ink">service_role キーは絶対に置かないこと。</strong>
          ブラウザに配られるため、RLS を全部素通りする鍵が公開されてしまいます。
          <code className="rounded-sm bg-surface-strong px-[4px]">.env.example</code> に雛形があります。
        </p>
      </div>
    </div>
  );
}
