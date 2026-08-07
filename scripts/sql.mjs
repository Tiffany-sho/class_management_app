/**
 * 開発用の SQL 実行ツール。
 *
 *   node scripts/sql.mjs supabase/dev/dummy_data.sql   ファイルを実行
 *   node scripts/sql.mjs -c "select count(*) from public.students"
 *
 * ★ このスクリプトは開発専用。アプリのバンドルには一切含まれない（src/ の外）。
 *
 * ★ 接続には DB のパスワードを使う。これは **RLS を全部素通りする鍵** で、
 *   service_role キーより強い。.env に SUPABASE_DB_PASSWORD として置く。
 *   .env は .gitignore 済み。**VITE_ を付けないこと**（付けるとバンドルに焼き込まれる）。
 *
 * エラーは PostgreSQL が返す位置と該当行を添えて出す。どの文で落ちたかを
 * 探すのに時間を取られると、直すより探す方が長くなるため。
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const password = env.SUPABASE_DB_PASSWORD;
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z]+)\./)?.[1];

if (!password) {
  console.error('.env に SUPABASE_DB_PASSWORD がありません。');
  console.error('Supabase の Settings → Database で確認・再設定できます。');
  process.exit(2);
}
if (!ref) {
  console.error('.env の VITE_SUPABASE_URL からプロジェクト参照 ID を読めませんでした。');
  process.exit(2);
}

/* プーラーのセッションモード（5432）を使う。
   6543 はトランザクションモードで、DDL や advisory lock で問題が出ることがある。 */
const client = new pg.Client({
  host: env.SUPABASE_DB_HOST || `aws-0-ap-southeast-1.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${ref}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

const args = process.argv.slice(2);
const sql = args[0] === '-c'
  ? args.slice(1).join(' ')
  : readFileSync(args[0], 'utf8');

if (!sql.trim()) {
  console.error('実行する SQL がありません。');
  process.exit(2);
}

/** エラーが起きた位置の前後を出す。position は1始まりのバイト位置ではなく文字位置 */
function showContext(text, position) {
  if (!position) return;
  const upto = text.slice(0, Number(position));
  const line = upto.split('\n').length;
  const lines = text.split('\n');
  const from = Math.max(0, line - 3);
  const to = Math.min(lines.length, line + 2);
  console.error('');
  for (let i = from; i < to; i++) {
    const mark = i === line - 1 ? '>' : ' ';
    console.error(`${mark} ${String(i + 1).padStart(4)} | ${lines[i]}`);
  }
}

try {
  await client.connect();
} catch (e) {
  console.error('接続できませんでした: ' + e.message);
  if (/password authentication failed/.test(e.message)) {
    console.error('SUPABASE_DB_PASSWORD が違います。Settings → Database で再設定してください。');
  }
  process.exit(1);
}

try {
  /* まとめて投げる。複数文でも1回のラウンドトリップで済み、
     PL/pgSQL の $$ ... $$ を自前で切り分けずに済む（切り分けは必ず壊れる）。 */
  const result = await client.query(sql);
  const list = Array.isArray(result) ? result : [result];

  for (const r of list) {
    if (r.command && r.rows?.length) {
      console.table(r.rows);
    } else if (r.command) {
      console.log(`${r.command} ${r.rowCount ?? 0} 行`);
    }
  }
  console.log('\n=== 成功 ===');
} catch (e) {
  console.error('=== エラー ===');
  console.error(`${e.severity ?? 'ERROR'}: ${e.message}`);
  if (e.code) console.error(`SQLSTATE: ${e.code}`);
  if (e.detail) console.error(`詳細: ${e.detail}`);
  if (e.hint) console.error(`ヒント: ${e.hint}`);
  if (e.where) console.error(`場所: ${e.where}`);
  showContext(sql, e.position);
  process.exitCode = 1;
} finally {
  await client.end();
}
