import { Badge, Card, Empty, Loading, ErrorNote } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchAnnouncements, fetchBusinesses } from '@/lib/queries';
import { sinceLabel } from '@/lib/date';

/**
 * お知らせ（受け取る側）。
 * 予約中のものは DB 側で除かれるので、ここに届いた時点で公開済み。
 */
export function NewsPage() {
  const state = useAsync(async () => {
    const [businesses, announcements] = await Promise.all([
      fetchBusinesses(), fetchAnnouncements(),
    ]);
    return { businesses, announcements };
  }, []);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map(d.businesses.map((b) => [b.id, b.name]));

  return (
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
                <span className="text-[14px] text-ink">{a.title}</span>
                {a.businessId ? <Badge tone="neutral">{bizMap.get(a.businessId) ?? '—'}</Badge> : null}
              </div>
              <p className="mt-[4px] whitespace-pre-wrap text-[13px] leading-relaxed text-body">
                {a.body}
              </p>
              <div className="mt-[6px] text-[11px] text-muted">
                {a.sentAt ? sinceLabel(a.sentAt) : sinceLabel(a.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
