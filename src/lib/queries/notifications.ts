import { supabase } from '../supabase';

/**
 * 通知。
 *
 * **行を作るのは DB のトリガーだけ。** アプリからは作らない。
 * アプリ側で作ると、ダッシュボードから直接操作したときや、別の画面から
 * 同じ操作をしたときに通知が漏れる。ここは読むのと既読にするだけ。
 *
 * RLS が自分あての行しか返さないので、user_id を条件に足さない。
 */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  subjectTable: string | null;
  subjectId: string | null;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read_at, created_at, subject_table, subject_id')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.read_at,
    createdAt: n.created_at,
    subjectTable: n.subject_table,
    subjectId: n.subject_id,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}
