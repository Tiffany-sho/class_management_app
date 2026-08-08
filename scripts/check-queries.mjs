/**
 * コードが DB に投げるものを、**本物のスキーマに突き合わせる**。
 *
 * ここでしか捕まらないものがある:
 *
 *   - 埋め込み（`select` の中の `表(...)`）の関係が解決できるか
 *     複合外部キーは**列名では引けない**。`schedules:schedule_id` と書くと
 *     400（PGRST200）になる。制約名で `schedules!schedule_students_schedule_fk` と書く。
 *   - `.eq/.order` などに渡す列が実在するか
 *   - `rpc()` の関数名と引数名が実在するか
 *
 * **型チェックは何も言わない**（select は文字列）。**手書きの fixture でも捕まらない**
 * （埋め込み結果を作り込んであるうえ、知らない列でのフィルタも素通りさせるため）。
 * 実際にこの検査で、生徒詳細の 400 を3件見つけている。
 *
 *   node scripts/check-queries.mjs
 *
 * `.env` が要る（API には CHECK_EMAIL / CHECK_PASSWORD、既定は動作確認用アカウント。
 * カタログ照会には SUPABASE_DB_PASSWORD）。**確かめられなかったときは必ず失敗にする** ――
 * 「検査できなかった」を「問題なし」と読み違えると、この仕組み自体が無意味になる。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.CHECK_EMAIL || 'nakamura@example.com';
const PASSWORD = process.env.CHECK_PASSWORD || 'rtech-demo-2026';

let bad = 0;
const fail = (m) => { console.log('FAIL ' + m); bad++; };

/* ------------------------------------------------------------ ソースを読む */

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : (/\.tsx?$/.test(p) ? [p] : []);
  });
}

/** クォートで囲まれた文字列を開始位置から取り出す */
function literalAt(src, i) {
  const q = src[i];
  if (!['\'', '"', '`'].includes(q)) return null;
  let out = '';
  for (let k = i + 1; k < src.length; k++) {
    if (src[k] === '\\') { out += src[k + 1]; k++; continue; }
    if (src[k] === q) return out;
    out += src[k];
  }
  return null;
}

const selects = [];   // { file, line, table, select }
const columns = [];   // { file, line, table, column, kind }
const rpcs = [];      // { file, line, fn, args }
let dynamic = 0;

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
  const lineOf = (i) => src.slice(0, i).split('\n').length;

  const re = /\.from\(\s*(['"`])([a-z_]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[2];
    const after = src.slice(m.index + 1);
    const nextFrom = after.search(/\.from\(\s*['"`]/);
    const block = src.slice(m.index, nextFrom < 0 ? m.index + 1500 : m.index + 1 + nextFrom);

    const sel = block.indexOf('.select(');
    const isWrite = /\.(insert|update|delete|upsert)\(/.test(block.slice(0, sel < 0 ? undefined : sel));
    if (sel >= 0 && !isWrite) {
      const text = literalAt(block, sel + '.select('.length);
      if (text === null) dynamic++;
      else if (text.includes('${')) dynamic++;
      else selects.push({ file: rel, line: lineOf(m.index), table, select: text.replace(/\s+/g, '') });
    }

    const fre = /\.(eq|neq|gt|gte|lt|lte|in|is|like|ilike|order)\(\s*(['"`])([a-z_]+)\2/g;
    let f;
    while ((f = fre.exec(block))) {
      columns.push({ file: rel, line: lineOf(m.index + f.index), table, column: f[3], kind: f[1] });
    }
  }

  const rre = /\.rpc\(\s*(['"`])([a-z_]+)\1\s*(?:,\s*\{([^}]*)\})?/g;
  let r;
  while ((r = rre.exec(src))) {
    rpcs.push({
      file: rel, line: lineOf(r.index), fn: r[2],
      args: (r[3] ?? '').match(/([a-z_]+)\s*:/g)?.map((x) => x.replace(/\s*:$/, '')) ?? [],
    });
  }
}

const uniqSelects = [...new Map(selects.map((s) => [`${s.table}|${s.select}`, s])).values()];
const uniqColumns = [...new Map(columns.map((c) => [`${c.table}.${c.column}`, c])).values()];
const uniqRpcs = [...new Map(rpcs.map((r) => [r.fn, r])).values()];

console.log(`select ${selects.length}件（重複を除いて ${uniqSelects.length}）`
  + ` / 列の指定 ${columns.length}箇所（${uniqColumns.length}組）`
  + ` / rpc ${uniqRpcs.length}個`);
if (dynamic > 0) fail(`動的に組み立てている select が ${dynamic}件ある。手で確かめること`);

/* ------------------------------------------- 1. 埋め込みを本物の API に投げる */

console.log('\n=== 1. 埋め込みが解決できるか（本物の PostgREST に投げる）===');
const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!auth.ok) {
  fail(`${EMAIL} でログインできず、埋め込みを検査できなかった（${auth.status}）。`
    + ' CHECK_EMAIL / CHECK_PASSWORD で実在するアカウントを指定すること');
} else {
  const token = (await auth.json()).access_token;
  let ng = 0;
  for (const s of uniqSelects) {
    const res = await fetch(
      `${URL_}/rest/v1/${s.table}?select=${encodeURIComponent(s.select)}&limit=1`,
      { headers: { apikey: ANON, authorization: `Bearer ${token}` } },
    );
    if (res.ok) continue;
    const body = await res.text();
    const code = (() => { try { return JSON.parse(body).code; } catch { return '?'; } })();
    /* PGRST200 = 関係が見つからない / PGRST100 = 解釈できない。どちらも書き方の誤り。
       RLS による絞り込みは 200 と空配列で返るので、ここには出てこない */
    if (code === 'PGRST200' || code === 'PGRST100') {
      fail(`${s.file}:${s.line} ${s.table}  ${code}  ${body.replace(/\s+/g, ' ').slice(0, 130)}`);
      ng++;
    } else {
      console.log(`WARN ${s.file}:${s.line} ${s.table} が ${res.status}（埋め込み以外の理由）`);
    }
  }
  if (ng === 0) console.log(`OK   ${uniqSelects.length}件すべて解決できる`);
}

/* --------------------------------------------- 2. 列と関数をカタログに当てる */

console.log('\n=== 2. 列と関数が実在するか（カタログに当てる）===');
let catalog = null;
try {
  catalog = {
    cols: execFileSync('node', [join(ROOT, 'scripts/sql.mjs'), '-c',
      "select table_name || '.' || column_name as k from information_schema.columns where table_schema='public'"],
      { encoding: 'utf8', cwd: ROOT, maxBuffer: 8 * 1024 * 1024 }),
    fns: execFileSync('node', [join(ROOT, 'scripts/sql.mjs'), '-c',
      "select p.proname || '(' || coalesce(array_to_string(p.proargnames, ','), '') || ')' as k"
      + " from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public'"],
      { encoding: 'utf8', cwd: ROOT, maxBuffer: 8 * 1024 * 1024 }),
  };
} catch {
  fail('カタログを引けず、列と関数を検査できなかった（.env の SUPABASE_DB_PASSWORD）');
}

if (catalog) {
  const known = new Set([...catalog.cols.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((x) => x[1]));
  const fnRows = [...catalog.fns.matchAll(/'([a-z_]+)\(([^']*)\)'/g)]
    .map((x) => ({ name: x[1], args: x[2] ? x[2].split(',') : [] }));

  let ng = 0;
  for (const c of uniqColumns) {
    if (!known.has(`${c.table}.${c.column}`)) {
      fail(`${c.file}:${c.line} ${c.table}.${c.column} は存在しない（.${c.kind}）`);
      ng++;
    }
  }
  if (ng === 0) console.log(`OK   列 ${uniqColumns.length}組すべて実在する`);

  for (const f of uniqRpcs) {
    const cand = fnRows.filter((x) => x.name === f.fn);
    if (cand.length === 0) { fail(`${f.file}:${f.line} ${f.fn}() が存在しない`); continue; }
    const missing = f.args.filter((a) => !cand.some((c) => c.args.includes(a)));
    if (missing.length) {
      fail(`${f.file}:${f.line} ${f.fn}() の引数 ${missing.join(',')} が無い`
        + `（実際: ${cand.map((c) => c.args.join(',') || 'なし').join(' / ')}）`);
    } else {
      console.log(`OK   ${f.fn}(${f.args.join(',')})`);
    }
  }
}

console.log(bad ? `\n=== 問題 ${bad} 件 ===` : '\n=== 問題 0 件 ===');
process.exit(bad ? 1 : 0);
