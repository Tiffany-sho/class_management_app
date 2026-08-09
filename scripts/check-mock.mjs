/*
 * モック（mock/index.html）が壊れていないかを見る。
 *
 * モックは**仕様の実物**（CLAUDE.md）。単一ファイルの静的 HTML なので型検査も
 * ビルドも通らず、壊しても誰も気づかないまま「これが仕様です」と残り続ける。
 * ここでは jsdom で実際に動かして、**各画面が描画された結果**を見る。
 *
 *   node scripts/check-mock.mjs
 *
 * 見るのは「行が出たか」ではなく、**アプリと同じ判断になっているか**まで。
 * 定員や受講希望のルールはアプリ側と食い違ってはいけない。
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'mock/index.html'), 'utf8');

let bad = 0;
const ck = (o, m) => { console.log((o ? 'OK   ' : 'FAIL ') + m); if (!o) bad++; };

const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
dom.virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
dom.window.addEventListener('error', (e) => errors.push('error: ' + e.message));
await new Promise((r) => setTimeout(r, 400));

if (errors.length) {
  errors.forEach((e) => console.log('FAIL ' + e));
  process.exit(1);            // 動かないものを検査しても意味がない
}
const d = dom.window.document;
console.log('スクリプトが最後まで走った\n');

/* --- 1. 各画面が中身つきで描かれたか --------------------------------------- */
const AREAS = [
  ['schedList', '管理者/スケジュール確定'],
  ['studentRows', '管理者/生徒'],
  ['revFeeRows', '管理者/月謝の支払い状況'],
  ['promoRows', '管理者/進級処理'],
  ['courseRows', '管理者/コース料金'],
  ['slotRows', '管理者/開催枠'],
  ['kidSwitch', '保護者/お子さま切替'],
  ['feeCard', '保護者/月謝'],
  ['nextCard', '保護者/次回の受講'],
  ['attendSummary', '保護者/受講状況'],
  ['pickList', '保護者/希望提出'],
  ['parentSched', '保護者/予定'],
  ['attList', '講師/出席'],
  ['ePickList', '講師/勤務希望'],
  ['empSched', '講師/勤務一覧'],
  ['empCal', '講師/カレンダー'],
];
for (const [id, label] of AREAS) {
  const el = d.getElementById(id);
  const n = el ? el.children.length : -1;
  ck(n > 0, `${label.padEnd(24)} 子要素 ${n}`);
}

/* --- 2. 定員の出し方がアプリと同じか ----------------------------------------
   **担当が0名のときは「定員超過」ではなく「担当未定」を出す。**
   定員 = 担当人数 × 係数 なので0名なら必ず超過だが、そのとき直すべきは
   人数であって受講人数ではない（DayDetailSheet / SlotCard と同じ判断）。 */
const caps = [...d.querySelectorAll('#schedList .cap > span:first-child')]
  .map((s) => s.textContent.trim());
const parsed = caps.map((t) => {
  const [a, b] = t.replace(/\s|名/g, '').split('/').map(Number);
  return { studs: a, cap: b };
});
const expectOver = parsed.filter((x) => x.cap > 0 && x.studs > x.cap).length;
const expectNoEmp = parsed.filter((x) => x.cap === 0).length;
const over = d.querySelectorAll('#schedList .badge.over').length;
const noEmp = d.querySelectorAll('#schedList .badge.unpaid').length;
console.log(`     コマごとの 生徒/定員: ${caps.join(' | ')}`);
ck(over === expectOver, `定員超過バッジ ${over}件（担当がいるのに溢れているコマ ${expectOver}件）`);
ck(noEmp === expectNoEmp, `担当未定バッジ ${noEmp}件（担当0名のコマ ${expectNoEmp}件）`);
ck(expectNoEmp > 0 && expectOver > 0,
   'どちらの状態も見本に含まれている（含まれていないと上の2つは何も検査していない）');

/* --- 3. 受講希望は候補。0件から候補ぜんぶまで選べる（ドメインルール2） ------ */
const picks = d.querySelectorAll('#pickList .pick');
const disabled = d.querySelectorAll('#pickList .pick[disabled]').length;
const max = Number(d.getElementById('pickMax').textContent);
ck(disabled === 0, `押せない候補が無い（候補 ${picks.length}件 / 押せない ${disabled}件）`);
ck(max === picks.length, `上限が候補の数そのもの（表示 ${max} / 候補 ${picks.length}）`);

/* --- 4. 中学卒業は自動で何もしない（ドメインの保留事項） -------------------- */
const rows = [...d.querySelectorAll('#promoRows tr')];
const approve = d.querySelectorAll('#promoRows button').length;
ck(rows.length > approve,
   `中学卒業の生徒には承認ボタンを出さない（検出 ${rows.length}名 / ボタン ${approve}個）`);

/* --- 5. 保護者の画面に出してはいけないもの ---------------------------------- */
const parentText = ['p-home', 'p-submit', 'p-plan']
  .map((id) => d.getElementById(id)?.textContent ?? '').join(' ').replace(/\s+/g, ' ');
ck(!/第\d+コマ/.test(parentText), '保護者の画面に「第〇コマ」が出ていない');
ck(!/¥[\d,]+/.test(d.getElementById('feeCard')?.textContent ?? ''),
   '月謝カードに金額（生の数字）が出ていない');

/* --- 6. 金額を調整した月だけ「見直しました」を出す --------------------------
   **出ることと出ないことを両方見る。** 出ることだけ見ると、無条件に出す作りでも
   通ってしまい、「毎月出る＝意味が消える」を検査で拾えない。 */
const feeText = () => (d.getElementById('feeCard')?.textContent ?? '').replace(/\s+/g, ' ');
const adjustedMonth = feeText();
ck(/金額を見直しました/.test(adjustedMonth), `調整した月に見直しの案内が出る（${adjustedMonth.slice(0, 46)}）`);
ck(/増額|減額/.test(adjustedMonth), '増えたか減ったかまで書いてある');
ck(!/¥[\d,]+/.test(adjustedMonth), '見直しの案内にも金額（生の数字）が出ていない');
dom.window.shiftKidMonth(-1);                       // 調整していない月へ
const plainMonth = feeText();
ck(!/金額を見直しました/.test(plainMonth),
   `調整していない月には出ない（${plainMonth.slice(0, 40)}）`);
dom.window.shiftKidMonth(1);

/* --- 7. 確定した月の希望提出は「決まった日」だけを出す ----------------------
   確定後も候補を並べたままだと、出した希望にチェックが付いた状態だけが見えて
   「結局どの日に決まったのか」がどこにも書かれない。
   ここでも**受付中と確定済みの両方**を見る（片方だけだと入れ替えを検査できない）。 */
const submitState = () => ({
  pPick: !d.getElementById('pPicking').hidden,
  pDone: !d.getElementById('pDecided').hidden,
  ePick: !d.getElementById('ePicking').hidden,
  eDone: !d.getElementById('eDecided').hidden,
});
const open = submitState();
ck(open.pPick && !open.pDone && open.ePick && !open.eDone,
   '受付中の月（9月）は候補を出す');

dom.window.shiftSub(-1);                            // 8月 = 確定済み
const done = submitState();
ck(!done.pPick && done.pDone && !done.ePick && done.eDone,
   '確定した月は候補を出さず、決まった日に入れ替わる');
const pDays = d.querySelectorAll('#pDecidedList .pick').length;
const eDays = d.querySelectorAll('#eDecidedList .pick').length;
ck(pDays > 0, `保護者の決まった日が中身つきで出る（${pDays}件）`);
ck(eDays > 0, `講師の決まった日が中身つきで出る（${eDays}件）`);
const pDone = d.getElementById('pDecidedList').textContent.replace(/\s+/g, ' ');
ck(!/第\d+コマ/.test(pDone), `決まった日にも「第〇コマ」が出ていない（${pDone.slice(0, 40)}）`);
ck(/生徒\d+名/.test(d.getElementById('eDecidedList').textContent),
   '講師の決まった日には人数が出る');
dom.window.shiftSub(1);
ck(submitState().pPick, '受付中の月に戻せる');

console.log(bad ? `\n=== 問題 ${bad} 件 ===` : '\n=== 問題 0 件 ===');
process.exit(bad ? 1 : 0);
