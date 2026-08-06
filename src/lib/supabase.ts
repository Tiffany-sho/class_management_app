import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Supabase クライアント。
 *
 * 環境変数が無くてもアプリを落とさない。未設定のまま真っ白になると
 * 「壊れている」のか「設定していないだけ」なのか区別できないため、
 * isConfigured を見て画面側で案内を出す。
 *
 * 型付けについて: src/types/database.ts は `npm run gen:types` の生成物。
 * **手書きしないこと。** スキーマを変えたら流し直す。
 * 生成物だが git に含めている。含めないとクローンしただけでは型チェックが
 * 通らず、生成には Supabase の認証情報が要るため。
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

/** 未設定のときも import 側が落ちないよう、ダミーの URL でクライアントは作る */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-not-set',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // 招待メールのリンクからセッションを拾う
    },
  },
);

/** Supabase のエラーをそのまま画面に出さず、日本語の一文にする */
export function toMessage(error: unknown): string {
  if (!error) return '';
  const raw = typeof error === 'string' ? error : ((error as { message?: string }).message ?? '');

  if (/Invalid login credentials/i.test(raw)) return 'メールアドレスかパスワードが違います。';
  if (/Email not confirmed/i.test(raw)) return 'メールアドレスがまだ確認されていません。招待メールのリンクを開いてください。';
  if (/JWT expired|invalid claim/i.test(raw)) return 'ログインの有効期限が切れました。もう一度ログインしてください。';
  if (/Failed to fetch|NetworkError/i.test(raw)) return 'サーバーに接続できませんでした。通信環境を確認してください。';
  // RLS で弾かれたときは行が見えないだけなので、原因を推測して伝える
  if (/new row violates row-level security/i.test(raw)) return 'この操作をする権限がありません。締め切りを過ぎている可能性もあります。';
  if (/violates unique constraint/i.test(raw)) return 'すでに登録されています。';
  if (/violates foreign key constraint/i.test(raw)) return '関連するデータが見つかりません。';

  // DB のトリガーが raise exception したメッセージは日本語なのでそのまま出す
  return raw || '不明なエラーが発生しました。';
}
