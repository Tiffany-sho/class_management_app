import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Button, Chip, Empty, Loading, ErrorNote, Note, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  decideOvertime, fetchAbsenceReports, fetchOvertimeRequests,
  fetchPromotionCandidates, markAbsenceHandled,
} from '@/lib/queries';
import { formatDayJa } from '@/lib/date';
import { yen } from '@/lib/format';
import { InboxRow, type InboxItem } from './InboxRow';

/**
 * 受信ボックス。「お知らせ」が管理者から送る側で、こちらが管理者に届く側。
 *
 * **一覧は元データから毎回組み立てる。** 通知側に状態をコピーしない。
 * コピーすると、申請が承認された後も受信ボックスだけ「承認待ち」のまま残る。
 * ここでの承認・確認は申請元と同じ行を更新するので、両方の画面が必ず一致する。
 */
export function InboxPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [onlyAction, setOnlyAction] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [overtime, absences, promotions] = await Promise.all([
      fetchOvertimeRequests(), fetchAbsenceReports(), fetchPromotionCandidates(),
    ]);
    return { overtime, absences, promotions };
  }, []);

  const run = async (key: string, fn: () => Promise<void>, message: string) => {
    setBusy(key);
    try {
      await fn();
      toast(message);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const items = useMemo<InboxItem[]>(() => {
    const d = state.data;
    if (!d) return [];
    const out: InboxItem[] = [];

    for (const o of d.overtime) {
      const pending = o.status === 'pending';
      out.push({
        id: `ot-${o.id}`,
        icon: 'file-check',
        title: `${o.employeeName} から時間外勤務の申請 ${o.hours.toFixed(1)}時間`,
        detail: pending
          ? `${formatDayJa(o.workDate)}・${o.description}（承認すると ${yen(o.amount)} が加算されます）`
          : `${formatDayJa(o.workDate)}・${o.description}（${o.status === 'approved' ? '承認済み' : '却下'}）`,
        at: o.decidedAt ?? `${o.workDate}T00:00:00`,
        needsAction: pending,
        actions: pending ? (
          <>
            <Button
              size="sm"
              disabled={busy === `ot-${o.id}`}
              onClick={() => void run(`ot-${o.id}`, () => decideOvertime(o.id, true), `${o.employeeName} の申請を承認しました`)}
            >
              承認
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === `ot-${o.id}`}
              onClick={() => void run(`ot-${o.id}`, () => decideOvertime(o.id, false), `${o.employeeName} の申請を却下しました`)}
            >
              却下
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => navigate('/overtime')}>開く</Button>
        ),
      });
    }

    for (const a of d.absences) {
      const unhandled = !a.handledAt;
      out.push({
        id: `ab-${a.id}`,
        icon: 'user-x',
        title: `${a.studentName} の欠席連絡`,
        detail: [
          a.sessionDate ? formatDayJa(a.sessionDate) : '対象コマ不明',
          a.slotNo ? `第${a.slotNo}コマ` : null,
          a.reason || '理由の記入なし',
        ].filter(Boolean).join('・'),
        at: a.createdAt,
        needsAction: unhandled,
        actions: unhandled ? (
          <Button
            size="sm"
            disabled={busy === `ab-${a.id}`}
            onClick={() => void run(`ab-${a.id}`, () => markAbsenceHandled(a.id), `${a.studentName} の欠席連絡を確認済みにしました`)}
          >
            確認済みにする
          </Button>
        ) : undefined,
      });
    }

    if (d.promotions.length > 0) {
      out.push({
        id: 'promo',
        icon: 'graduation',
        title: `進級によるコース変更 ${d.promotions.length}件`,
        detail: `${d.promotions.map((p) => p.studentName).join('、')} が学年区分を超えています。承認するまで旧コースのままです。`,
        at: new Date().toISOString(),
        needsAction: false,
        actions: <Button size="sm" variant="ghost" onClick={() => navigate('/promotion')}>開く</Button>,
      });
    }

    // 要対応を先に、その中では新しい順
    return out.sort((a, b) =>
      Number(b.needsAction) - Number(a.needsAction) || b.at.localeCompare(a.at));
  }, [state.data, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  const actionCount = items.filter((i) => i.needsAction).length;
  const shown = onlyAction ? items.filter((i) => i.needsAction) : items;

  return (
    <div>
      <PageHeader
        title="受信ボックス"
        description="講師・保護者からの申請や連絡が届きます。対応が必要なものが上に並びます。"
      />

      <div className="mb-md flex flex-wrap gap-xs">
        <Chip active={onlyAction} onClick={() => setOnlyAction(true)}>要対応 {actionCount}</Chip>
        <Chip active={!onlyAction} onClick={() => setOnlyAction(false)}>すべて {items.length}</Chip>
      </div>

      <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-card">
        {shown.length === 0 ? (
          <Empty
            title={onlyAction ? '対応が必要なものはありません。' : '届いているものはありません。'}
            hint={onlyAction && items.length > 0 ? '「すべて」に切り替えると処理済みのものも見られます。' : undefined}
          />
        ) : (
          <ul>
            {shown.map((it, i) => (
              <InboxRow key={it.id} item={it} last={i === shown.length - 1} />
            ))}
          </ul>
        )}
      </div>

      <Note>
        ここでの<strong className="text-ink">承認・確認は、申請元の画面と同じデータを更新します</strong>。
        時間外勤務を承認すると、申請一覧でも給与の計算でも同時に反映されます。
        一覧は元のデータから毎回組み立てているので、状態がずれることはありません。
      </Note>
    </div>
  );
}
