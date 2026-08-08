import { Icon } from '@/components/ui';

/**
 * 動作確認用アカウントの一覧。
 *
 * ★★ **本物のデータを入れる前に、このファイルごと消すこと。**
 *   このリポジトリは公開されているので、ここに載せた時点で誰でも
 *   これらのアカウントで入れる。消し方:
 *     1. supabase/dev/dummy_data_cleanup.sql を実行してアカウントを消す
 *     2. このファイルと LoginPage からの読み込みを消す
 *
 * 押すと入力欄に入る。手で打つと打ち間違いで「パスワードが違う」と出て、
 * 設定を疑うことになるため。
 */
export const DEMO_PASSWORD = 'rtech-demo-2026';

/* 「2人」= きょうだいが2人いる保護者。子の切り替えを試すときはこちらを使う。
   **きょうだいは必ず同じ事業**なので、1人の保護者が2事業にまたがることはない。 */
const ACCOUNTS: { role: string; name: string; email: string }[] = [
  { role: '講師（プログラミング）', name: '中村 さとし', email: 'nakamura@example.com' },
  { role: '講師（プログラミング）', name: '高橋 けんた', email: 'takahashi@example.com' },
  { role: '講師（イラスト）', name: '小林 あやか', email: 'kobayashi@example.com' },
  { role: '講師（イラスト）', name: '渡辺 みほ', email: 'watanabe@example.com' },
  { role: '講師（イラスト）', name: '伊藤 ゆうき', email: 'ito@example.com' },
  { role: '講師（イラスト）', name: '山本 えみ', email: 'yamamoto@example.com' },
  { role: '講師（イラスト）', name: '加藤 りょう', email: 'kato@example.com' },
  { role: '保護者（プログラミング・2人）', name: '田中 さくら', email: 'tanaka@example.com' },
  { role: '保護者（プログラミング）', name: '佐藤 ひろみ', email: 'sato@example.com' },
  { role: '保護者（プログラミング・2人）', name: '鈴木 なおき', email: 'suzuki@example.com' },
  { role: '保護者（プログラミング・2人）', name: '山田 かおり', email: 'yamada@example.com' },
  { role: '保護者（プログラミング）', name: '中川 たかし', email: 'nakagawa@example.com' },
  { role: '保護者（プログラミング・2人）', name: '石井 まなみ', email: 'ishii@example.com' },
  { role: '保護者（イラスト・2人）', name: '森 ちひろ', email: 'mori@example.com' },
  { role: '保護者（イラスト・2人）', name: '池田 ゆうこ', email: 'ikeda@example.com' },
  { role: '保護者（イラスト・2人）', name: '大西 けいすけ', email: 'onishi@example.com' },
  { role: '保護者（イラスト）', name: '平野 あき', email: 'hirano@example.com' },
  { role: '保護者（イラスト・2人）', name: '内田 まゆみ', email: 'uchida@example.com' },
  { role: '保護者（イラスト）', name: '三浦 しんじ', email: 'miura@example.com' },
  { role: '保護者（イラスト・2人）', name: '松本 なつき', email: 'matsumoto@example.com' },
  { role: '保護者（イラスト）', name: '木下 ひかる', email: 'kinoshita@example.com' },
  { role: '保護者（イラスト・2人）', name: '川村 さおり', email: 'kawamura@example.com' },
];

export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  return (
    <details className="mt-lg rounded-md border border-[#e8d9bb] bg-cream">
      <summary className="cursor-pointer list-none px-md py-sm text-[13px] text-ink">
        <span className="flex items-center gap-xs">
          <Icon name="warning" size={14} className="text-coral" />
          動作確認用アカウント（本番データを入れる前に消すこと）
        </span>
      </summary>

      <div className="border-t border-[#e8d9bb] px-md py-sm">
        <p className="mb-sm text-[12px] leading-relaxed text-muted">
          パスワードはすべて <code className="text-ink">{DEMO_PASSWORD}</code> です。
          押すと入力欄に入ります。
          <strong className="text-ink">これらは公開リポジトリに載っているので、誰でも入れます。</strong>
        </p>

        <ul className="flex flex-col gap-[2px]">
          {ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => onPick(a.email, DEMO_PASSWORD)}
                className="flex w-full items-center gap-sm rounded-sm px-xs py-[5px] text-left
                  text-[12px] hover:bg-[#f3e6cd]"
              >
                <span className="w-[190px] shrink-0 text-muted">{a.role}</span>
                <span className="w-[100px] shrink-0 text-ink">{a.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{a.email}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-sm text-[12px] leading-relaxed text-muted">
          管理者は自分のアカウントでログインしてください（ここには載せていません）。
        </p>
      </div>
    </details>
  );
}
