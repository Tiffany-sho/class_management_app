import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Card, Empty, Loading, ErrorNote, Note, SectionLabel, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { deleteAnnouncement, fetchAnnouncements, fetchBusinesses } from '@/lib/queries';
import { sinceLabel } from '@/lib/date';
import { AnnouncementForm } from './AnnouncementForm';

const TARGET_LABEL: Record<string, string> = {
  parent: '保護者のみ',
  employee: '講師のみ',
};

/** お知らせ。管理者から送る側（受信ボックスが管理者に届く側） */
export function AnnouncementsPage() {
  const { toast } = useToast();

  const state = useAsync(async () => {
    const [businesses, announcements] = await Promise.all([
      fetchBusinesses(), fetchAnnouncements(),
    ]);
    return { businesses, announcements };
  }, []);

  const remove = async (id: string, title: string) => {
    try {
      await deleteAnnouncement(id);
      toast(`「${title}」を削除しました`);
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
  const pending = d.announcements.filter((a) => !a.sentAt).length;

  return (
    <div>
      <PageHeader
        title="お知らせ"
        description={pending ? `予約中 ${pending}件` : '予約中のものはありません'}
      />

      <div className="grid gap-lg app:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <SectionLabel>投稿した一覧</SectionLabel>
          <Card>
            {d.announcements.length === 0 ? (
              <Empty
                title="まだ投稿がありません。"
                hint="右のフォームから投稿できます。日時を入れると予約になります。"
              />
            ) : (
              <ul>
                {d.announcements.map((a, i) => {
                  const scheduled = !a.sentAt && a.scheduledAt;
                  return (
                    <li
                      key={a.id}
                      className={`px-md py-sm ${i < d.announcements.length - 1 ? 'border-b border-hairline' : ''}`}
                    >
                      <div className="flex flex-wrap items-center gap-xs">
                        <span className="text-ui-md text-ink">{a.title}</span>
                        {scheduled ? <Badge tone="warn">予約中</Badge> : <Badge tone="success">送信済み</Badge>}
                        {a.targetRole ? <Badge tone="info">{TARGET_LABEL[a.targetRole]}</Badge> : null}
                        {a.businessId ? <Badge tone="neutral">{bizMap.get(a.businessId) ?? '—'}</Badge> : null}
                      </div>
                      <p className="mt-[4px] whitespace-pre-wrap text-ui-base leading-relaxed text-body">
                        {a.body}
                      </p>
                      <div className="mt-[6px] flex items-center gap-sm text-ui-xs text-muted">
                        <span>{a.authorName}</span>
                        <span>
                          {scheduled
                            ? `送信予定 ${new Date(a.scheduledAt!).toLocaleString('ja-JP')}`
                            : a.sentAt ? sinceLabel(a.sentAt) : ''}
                        </span>
                        <button
                          type="button"
                          className="ml-auto text-link underline"
                          onClick={() => void remove(a.id, a.title)}
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Note>
            予約したものは<strong className="text-ink">時刻になるまで対象者には表示されません</strong>（DB 側で隠しています）。
            送信は <code>pg_cron</code> が5分おきに拾います。
            <strong className="text-ink">この登録を忘れていると、予約したまま永遠に送られません。</strong>
          </Note>
        </div>

        <div>
          <AnnouncementForm businesses={d.businesses} onCreated={state.reload} />
        </div>
      </div>
    </div>
  );
}
