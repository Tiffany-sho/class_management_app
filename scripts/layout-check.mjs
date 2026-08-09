/*
 * 本物のブラウザで開いて、**実際のピクセル**を測る。
 *
 * jsdom はレイアウトを計算しないので、これまで確かめられなかったのがここ。
 * 「切り詰め（…）の指定が無い」までは静的に見られるが、**折り返しは測らないと分からない**。
 * 実際、文字を大きくしたときに出席リストの「鈴木 ひなた」が3行に折れていたのを、
 * jsdom のテストは1本も落とさずに通していた（文字は全部見えているので）。
 *
 * 端末にインストール済みの Chrome / Edge を使う。**Chromium はダウンロードしない**
 * （playwright-core はブラウザを同梱しない）。
 *
 *   node scripts/layout-check.mjs [URL]
 *     ROLE=parent|employee   見るロール
 *     EMAIL=... PASSWORD=... 入るアカウント
 *     BROWSER=<exeのパス>    ブラウザを明示する
 *     SHOTS=<ディレクトリ>   スクリーンショットの置き場
 *
 * URL は既定で http://localhost:4173（`npm run preview`）。
 * **`npm run dev` のサーバーには当てないこと** ―― tailwind.config.js を変えたあとの
 * dev サーバーは再起動するまで古い CSS を配り続け、直したはずのものが直って見えない。
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.log('FAIL ブラウザが見つかりません。BROWSER=<exeのパス> で指定してください。');
  console.log('     探した場所:\n       ' + CANDIDATES.join('\n       '));
  process.exit(1);   // 検査できなかったときは必ず失敗にする
}

const URL_ = process.argv[2] || 'http://localhost:4173/';
const ROLE = process.env.ROLE || 'parent';
const EMAIL = process.env.EMAIL
  || { parent: 'tanaka@example.com', employee: 'nakamura@example.com' }[ROLE];
const PASSWORD = process.env.PASSWORD || 'rtech-demo-2026';
const SHOT = process.env.SHOTS || null;
if (SHOT) mkdirSync(SHOT, { recursive: true });

/** スマホ / タブレット / PC。clamp() の効き方が変わる幅を選んである */
const SIZES = [
  { w: 375, h: 812, name: 'スマホ' },
  { w: 768, h: 1024, name: 'タブレット' },
  { w: 1280, h: 900, name: 'PC' },
];

let bad = 0;
const ck = (o, m) => { console.log((o ? 'OK   ' : 'FAIL ') + m); if (!o) bad++; };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
console.log(`使うブラウザ: ${CHROME}\n対象: ${URL_} / ROLE=${ROLE}`);

for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(URL_, { waitUntil: 'networkidle' });
  if (await page.locator('input[type="email"]').count()) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.getByRole('button', { name: /ログイン/ }).first().click();
    await page.waitForTimeout(3500);
  }
  if (await page.locator('input[type="email"]').count()) {
    ck(false, `ログインできない（${EMAIL}）`);
    await ctx.close();
    continue;
  }

  console.log(`\n########## ${size.name} ${size.w}×${size.h}`);

  /* --- 1. clamp() の文字サイズが本当に効いているか（ブラウザが計算した値） --- */
  const fonts = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[class*="text-ui-"]')) {
      const cls = [...el.classList].find((c) => c.startsWith('text-ui-'));
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (cls && (!out[cls] || px > out[cls])) out[cls] = px;
    }
    return out;
  });
  const tiers = Object.keys(fonts).sort();
  ck(tiers.length > 0, '可変の文字サイズが効いている: '
    + tiers.map((n) => `${n.replace('text-ui-', '')}=${fonts[n].toFixed(1)}`).join(' '));
  const tooSmall = tiers.filter((n) => fonts[n] < 12);
  ck(tooSmall.length === 0, `12px 未満の文字が無い（${tooSmall.join(',') || 'なし'}）`);

  /* 画面を1つずつ回る。ホームだけ見て「問題なし」にすると、いちばん詰まりやすい
     カレンダーと表を一度も測らないまま終わる。
     保護者・講師はボトムタブ、管理者はサイドバー（狭い画面では引き出しの中）。 */
  const NAV = (await page.locator('nav[aria-label="メインメニュー"] a').count())
    ? 'nav[aria-label="メインメニュー"] a'
    : 'aside nav a';
  /* 狭い画面ではサイドバーが引き出しに入っている。`-translate-x-full` で画面外へ
     ずらしてあるだけなので **isVisible() は true を返す**。開いているかどうかは
     **左端が画面内にあるか**で見る。
     開け閉めは DOM から直接押す ―― 引き出しが開くと今度は開くボタンがその下に
     隠れて、座標で押すと「別の要素が横取りする」で止まる。 */
  const isOpen = () => page.evaluate(() => {
    const a = document.querySelector('aside');
    return a ? a.getBoundingClientRect().left >= 0 : false;
  });
  const narrow = () => page.evaluate(() =>
    Boolean(document.querySelector('button[aria-label="メニューを開く"]')?.offsetParent));
  const drawer = async () => {
    if (NAV !== 'aside nav a' || !(await narrow()) || await isOpen()) return;
    await page.evaluate(() =>
      document.querySelector('button[aria-label="メニューを開く"]')?.click());
    await page.waitForTimeout(500);
  };
  const closeDrawer = async () => {
    if (NAV !== 'aside nav a' || !(await narrow()) || !(await isOpen())) return;
    await page.evaluate(() =>
      document.querySelector('aside')?.parentElement
        ?.querySelector('[aria-hidden].fixed.inset-0')?.click());
    await page.waitForTimeout(400);
  };
  await drawer();
  const tabs = await page.$$eval(NAV, (as) => as.map((a) => a.textContent.trim()));
  for (const [i, tab] of (tabs.length ? tabs : ['(1画面のみ)']).entries()) {
    if (tabs.length) {
      await drawer();
      /* **DOM 経由で押す。** 引き出しの中のリンクは、上のヘッダーに重なる位置まで
         スクロールされると「別の要素がクリックを横取りする」で押せない。
         ここで見たいのは押せるかどうかではなく、開いたあとの寸法。 */
      await page.evaluate(
        ([sel, n]) => document.querySelectorAll(sel)[n]?.click(),
        [NAV, i],
      );
      await page.waitForTimeout(2600);
      // 引き出しは開いたままだと本文に重なる。閉じてから測る
      await closeDrawer();
    }
    console.log(`--- ${tab}`);

    /* --- 2. 横にはみ出していないか --- */
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    ck(over.doc <= 0 && over.body <= 0,
       `横にはみ出していない（doc +${over.doc}px / body +${over.body}px）`);

    /* --- 3. 文字が枠から切れていないか。
       overflow-x-auto の中は「スクロールさせる」と決めた場所なので除外する --- */
    const clipped = await page.evaluate(() => {
      const scrollable = (el) => {
        for (let p = el; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll') return true;
        }
        return false;
      };
      const out = [];
      for (const el of document.querySelectorAll('span,div,p,h1,h2,h3,td,th,button,a')) {
        if (el.children.length > 0) continue;
        const t = (el.textContent || '').trim();
        if (!t) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const d = el.scrollWidth - el.clientWidth;
        if (d > 1 && !scrollable(el)) out.push({ t: t.slice(0, 26), d });
      }
      return out;
    });
    ck(clipped.length === 0, `文字が切れていない（${clipped.length}件）`);
    clipped.slice(0, 5).forEach((c) => console.log(`     ▸ +${c.d}px 「${c.t}」`));

    /* --- 4. 短い語（氏名・見出し・ボタン）が折り返していないか ---
       行数の数え方を2回まちがえた。記録しておく:
         (a) 高さ ÷ 行の高さ … padding を数え、ボタンが常に2行に見える
         (b) Range.getClientRects() の**個数** … 「3・4学年」のように欧文と和文が
             混ざると、同じ行でもフォントごとに rect が分かれて4行と数える
       正しくは **rect の上端が何種類あるか**（＝行ボックスの数）。 */
    const measure = `(el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
    }`;

    /* この検査が本当に落ちるのかを毎回確かめる。「0件」が数え方の誤りでないと
       言い切れないため。見つけられなければ検査そのものを失敗にする。 */
    const probe = await page.evaluate(`(() => {
      const el = document.createElement('div');
      el.style.cssText = 'width:22px;font-size:14px;line-height:1.4;position:absolute;top:0;left:0';
      el.textContent = '鈴木 ひなた';
      document.body.appendChild(el);
      const n = (${measure})(el);
      el.remove();
      return n;
    })()`);
    ck(probe >= 2, `折り返しを見つけられる（わざと折った見本は ${probe}行）`);

    const wrapped = await page.evaluate(`(() => {
      const lines = ${measure};
      const out = [];
      for (const el of document.querySelectorAll('span,div,h1,h2,h3,td,th,button,a,dt,dd')) {
        if (el.children.length > 0) continue;
        const t = (el.textContent || '').trim();
        if (!t || t.length > 12 || /[。、]/.test(t)) continue;   // 長いものは文章
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const n = lines(el);
        if (n >= 2) out.push({ t, n, cls: el.className.toString().slice(0, 54) });
      }
      return out;
    })()`);
    ck(wrapped.length === 0, `短い語が折り返していない（${wrapped.length}件）`);
    wrapped.slice(0, 5).forEach((c) => console.log(`     ▸ ${c.n}行「${c.t}」 ${c.cls}`));

    if (SHOT) await page.screenshot({ path: `${SHOT}/${ROLE}-${size.w}-${tab}.png`, fullPage: true });
  }

  ck(errors.length === 0, `実行時エラーが無い（${errors.slice(0, 2).join(' / ') || 'なし'}）`);
  await ctx.close();
}

await browser.close();
console.log(bad ? `\n=== ROLE=${ROLE}: 問題 ${bad} 件 ===` : `\n=== ROLE=${ROLE}: 問題 0 件 ===`);
process.exit(bad ? 1 : 0);
