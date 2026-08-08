import {
  Badge, Button, Card, Empty, Icon, Loading, ErrorNote, Note, SectionLabel, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  fetchAnnouncements, fetchBusinesses, fetchNotifications,
  markAllNotificationsRead, markNotificationRead,
} from '@/lib/queries';
import { sinceLabel } from '@/lib/date';
import type { IconName } from '@/components/ui';

/** 通知の種類ごとのアイコン。知らない種類が来ても落ちないよう既定を持つ */
const ICON: Record<string, IconName> = {
  schedule_confirmed: 'calendar-check',
  absence_reported: 'user-x',
  overtime_decided: 'file-check',
  announcement: 'megaphone',
};

/**
 * お知らせ（受け取る側）。
 *
 * 上が**自分あての通知**（`notifications`）、下が**教室からのお知らせ**（`announcements`）。
 * 通知は DB のトリガーが作るので、ダッシュボードから直接操作しても漏れない。
 * 予約中のお知らせは RLS が隠すので、ここに出た時点で公開済み。
 */
export function NewsPage() {
  const { toast } = useToast();

  const state = useAsync(async () => {
    const [businesses, announcements, notifications] = await Promise.all([
      fetchBusinesses(), fetchAnnouncements(), fetchNotifications(),
    ]);
    return { businesses, announcements, notifications };
  }, []);

  const readAll = async () => {
    try {
      const n = await markAllNotificationsRead();
      toast(n === 0 ? '未読はありません。' : `${n}件を既読にしました`);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    }
  };

  const read = async (id: string) => {
    try {
      await markNotificationRead(id);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map(d.businesses.map((b) => [b.id, b.name]));
  const unread = d.notifications.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="mb-xs flex items-center gap-sm">
        <SectionLabel>通知{unread ? `（未読 ${unread}）` : ''}</SectionLabel>
        <span className="flex-1" />
        {unread > 0 ? (
          <Button size="sm" onClick={() => void readAll()}>すべて既読にする</Button>
        ) : null}
      </div>

      <Card className="mb-lg">
        {d.notifications.length === 0 ? (
          <Empty
            title="通知はありません。"
            hint="予定の確定や申請の結果がここに届きます。"
          />
        ) : (
          <ul>
            {d.notifications.map((n, i) => (
              <li
                key={n.id}
                className={`${i < d.notifications.length - 1 ? 'border-b border-hairline' : ''}
                  ${n.readAt ? '' : 'bg-[#f4f8ff]'}`}
              >
                <button
                  type="button"
                  disabled={Boolean(n.readAt)}
                  onClick={() => void read(n.id)}
                  className="flex w-full items-start gap-sm px-md py-sm text-left"
                >
                  <Icon
                    name={ICON[n.type] ?? 'bell'}
                    className={`mt-[3px] ${n.readAt ? 'text-muted' : 'text-info'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-xs">
                      <span className="text-ui-md text-ink">{n.title}</span>
                      {n.readAt ? null : <Badge tone="info">未読</Badge>}
                    </span>
                    {n.body ? (
                      <span className="mt-[3px] block text-ui-sm leading-relaxed text-muted">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-[3px] block text-ui-xs text-muted">
                      {sinceLabel(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionLabel>教室からのお知らせ</SectionLabel>
      <Card>
        {d.announcements.length === 0 ? (
          <Empty title="お知らせはありません。" />
        ) : (
          <ul>
            {d.announcements.map((a, i) => (
              <li
                key={a.id}
                className={`px-md py-sm ${i < d.announcements.length - 1 ? 'border-b border-hairline' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="text-ui-md text-ink">{a.title}</span>
                  {a.businessId ? <Badge tone="neutral">{bizMap.get(a.businessId) ?? '—'}</Badge> : null}
                </div>
                <p className="mt-[4px] whitespace-pre-wrap text-ui-base leading-relaxed text-body">
                  {a.body}
                </p>
                <div className="mt-[6px] text-ui-xs text-muted">
                  {sinceLabel(a.sentAt ?? a.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Note>
        通知は<strong className="text-ink">操作が起きたときに DB 側で作られます</strong>。
        管理者が画面から操作しても、直接データベースを操作しても、同じように届きます。
      </Note>
    </div>
  );
}
