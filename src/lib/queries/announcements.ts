import { supabase } from '../supabase';
import type { Announcement } from '@/types/domain';

/**
 * お知らせ。管理者から送る側（受信ボックスが届く側）。
 *
 * 予約投稿は `scheduled_at` を未来にして `sent_at` を空にしておく。
 * 送信は pg_cron が `send_due_announcements()` を回して `sent_at` を埋める。
 * **RLS が `sent_at` の入っていないものを対象者に見せない**ので、
 * 予約中のものが先に読まれることはない。
 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, author_id, target_role, business_id, scheduled_at, sent_at, created_at, users:author_id ( name )')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => {
    const u = a.users as unknown as { name: string } | null;
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      authorName: u?.name ?? '—',
      targetRole: (a.target_role as 'parent' | 'employee' | null) ?? null,
      businessId: a.business_id,
      scheduledAt: a.scheduled_at,
      sentAt: a.sent_at,
      createdAt: a.created_at,
    };
  });
}

export interface NewAnnouncement {
  title: string;
  body: string;
  targetRole: 'parent' | 'employee' | null;
  businessId: string | null;
  /** null = すぐ送る。未来の日時を入れると pg_cron が拾うまで対象者に見えない */
  scheduledAt: string | null;
}

export async function createAnnouncement(a: NewAnnouncement): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const authorId = session.session?.user.id;
  if (!authorId) throw new Error('ログイン情報が取得できませんでした。');

  const { error } = await supabase.from('announcements').insert({
    title: a.title,
    body: a.body,
    author_id: authorId,
    target_role: a.targetRole,
    business_id: a.businessId,
    scheduled_at: a.scheduledAt,
    // 予約でなければこの場で送信済みにする（cron を待たせない）
    sent_at: a.scheduledAt ? null : new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
