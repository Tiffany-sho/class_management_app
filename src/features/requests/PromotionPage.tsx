import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Button, DataTable, Loading, ErrorNote, Note, useToast, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { applyPromotion, fetchBusinesses, fetchPromotionCandidates } from '@/lib/queries';
import { gradeLabel } from '@/lib/date';
import { yen } from '@/lib/format';
import type { Business, PromotionCandidate } from '@/types/domain';

/**
 * 進級処理。
 *
 * **検出だけを自動で行い、適用は管理者が承認して初めて実行する**（ドメインルール9）。
 * 学年は enrollment_year から毎回計算しているので、4月になれば自動でここに出る。
 * ただし黙って適用すると、保護者に知らせないまま請求額が変わってしまう。
 */
export function PromotionPage() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [businesses, candidates] = await Promise.all([
      fetchBusinesses(), fetchPromotionCandidates(),
    ]);
    return { businesses, candidates };
  }, []);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map<string, Business>(d.businesses.map((b) => [b.id, b]));

  const apply = async (p: PromotionCandidate) => {
    if (!p.suggestedCourseId) return;
    setBusy(p.studentId);
    try {
      await applyPromotion(p.studentId, p.suggestedCourseId);
      toast(`${p.studentName} のコースを ${p.suggestedGradeLabel} に変更しました`);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<PromotionCandidate>[] = [
    { key: 'name', header: '生徒', render: (p) => <span className="text-ink">{p.studentName}</span> },
    {
      key: 'business',
      header: '事業',
      render: (p) => {
        const b = bizMap.get(p.businessId);
        return (
          <Badge tone={b?.colorKey === 'forest' ? 'prog' : 'illust'}>{b?.name ?? '—'}</Badge>
        );
      },
    },
    { key: 'grade', header: '学年', numeric: true, render: (p) => <span className="tnum">{gradeLabel(p.grade)}</span> },
    {
      key: 'current',
      header: '現在のコース',
      render: (p) => (
        <div>
          <div className="text-ink">{p.currentGradeLabel}</div>
          <div className="text-[12px] text-muted tnum">
            月{p.sessionsPerMonth}回 / {yen(p.currentFee)}
          </div>
        </div>
      ),
    },
    {
      key: 'next',
      header: '変更後',
      render: (p) => (
        p.suggestedCourseId ? (
          <div>
            <div className="text-ink">{p.suggestedGradeLabel}</div>
            <div className="text-[12px] text-muted tnum">
              月{p.sessionsPerMonth}回 / {yen(p.suggestedFee ?? 0)}
            </div>
          </div>
        ) : (
          <span className="text-[12px] text-coral">該当するコースがありません</span>
        )
      ),
    },
    {
      key: 'diff',
      header: '差額',
      numeric: true,
      render: (p) => (
        p.feeDiff === null ? <span className="text-muted">—</span> : (
          <span className={`tnum ${p.feeDiff > 0 ? 'text-coral' : p.feeDiff < 0 ? 'text-forest' : 'text-muted'}`}>
            {p.feeDiff > 0 ? '+' : ''}{yen(p.feeDiff)}
          </span>
        )
      ),
    },
    {
      key: 'action',
      header: '',
      render: (p) => (
        p.suggestedCourseId ? (
          <Button size="sm" onClick={() => void apply(p)} disabled={busy === p.studentId}>
            承認して変更
          </Button>
        ) : null
      ),
    },
  ];

  const noCourse = d.candidates.filter((p) => !p.suggestedCourseId).length;

  return (
    <div>
      <PageHeader
        title="進級処理"
        description={`学年区分が変わってコース変更が必要な生徒 ${d.candidates.length}名`}
      />

      <Note>
        <strong className="text-ink">この画面を開いただけでは何も変わりません。</strong>
        「承認して変更」を押して初めてコースが切り替わります。
        保護者に知らせないまま請求額が変わることを防ぐため、自動では適用していません。
        月の回数（月2回／月3回）は維持されます。
      </Note>

      <DataTable
        columns={columns}
        rows={d.candidates}
        rowKey={(p) => p.studentId}
        empty="コース変更が必要な生徒はいません。"
      />

      {noCourse > 0 ? (
        <Note icon="warning">
          <strong className="text-ink">{noCourse}名は該当するコースがありません。</strong>
          中学を卒業した生徒の扱い（在籍終了にするか、継続用のコースを作るか）は
          まだ決まっていません。決まるまでシステムからは自動で何もしないので、
          個別に対応してください。
        </Note>
      ) : null}

      <p className="mt-md text-[12px] leading-relaxed text-muted">
        すでに発行済みの月謝は変わりません（<strong className="text-ink">請求額は発行時にコピーして保存している</strong>ため）。
        変わるのは次に生成される月からです。
      </p>
    </div>
  );
}
