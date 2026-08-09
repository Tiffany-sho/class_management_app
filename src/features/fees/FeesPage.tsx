import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Button, Loading, ErrorNote, MonthNav, Note, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  fetchBusinesses, fetchFees, fetchStudents, generateFees, isAdjusted,
} from '@/lib/queries';
import { currentMonthKey, formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import { StatCards } from '@/features/revenue/StatCards';
import { FeeTable } from './FeeTable';
import { FeePaymentSheet, type FeeTarget } from './FeePaymentSheet';

/**
 * 月謝。
 *
 * **収入・収益から分けた。** あちらは「今月いくら残ったか」を見る画面で、
 * 月に一度あれば足りる。月謝は**毎月の入金を1件ずつ記録していく作業**で、
 * 開く回数も見る単位も違う。同じ画面に置くと、督促のたびに収支の数字を
 * かき分けて表の位置まで下りることになる。
 *
 * 発行 → 入金の記録 → 金額の調整 まで、月謝でやることはここに集める。
 */
export function FeesPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState<FeeTarget | null>(null);

  const state = useAsync(async () => {
    const [businesses, students, fees] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchFees(month),
    ]);
    return { businesses, students, fees };
  }, [month]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const issue = async () => {
    setBusy(true);
    try {
      const n = await generateFees(month);
      toast(n === 0
        ? 'すでに全員ぶん発行済みです。'
        : `${formatMonthJa(month)}の月謝を ${n}件 発行しました`);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rows = [...d.fees.values()];
  const billed = rows.reduce((a, f) => a + f.amount, 0);
  const collected = rows.reduce((a, f) => a + (f.status === 'paid' ? f.amount : 0), 0);
  const unpaidRows = rows.filter((f) => f.status === 'unpaid');
  const unbilled = d.students.filter((s) => !d.fees.has(s.id)).length;
  const adjusted = rows.filter(isAdjusted).length;

  return (
    <div>
      <PageHeader
        title="月謝"
        description="請求の発行と、入金の記録。"
        actions={
          <div className="flex items-center gap-sm">
            <MonthNav value={month} onChange={setMonth} />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || unbilled === 0}
              onClick={() => void issue()}
            >
              {unbilled === 0 ? '全員ぶん発行済み' : `月謝を発行（${unbilled}名）`}
            </Button>
          </div>
        }
      />

      {/* **未払いを先に出す。** この画面を開く理由はたいてい督促なので、
          いちばん左に「誰が残っているか」を置く */}
      <StatCards stats={[
        { label: '未入金', value: `${unpaidRows.length}名`,
          tone: unpaidRows.length ? 'coral' : 'forest',
          hint: yen(rows.reduce((a, f) => a + (f.status === 'unpaid' ? f.amount : 0), 0)) },
        { label: '入金済み', value: yen(collected),
          hint: `${rows.length - unpaidRows.length} / ${rows.length}名` },
        { label: '請求合計', value: yen(billed),
          hint: adjusted ? `うち ${adjusted}名は金額を調整` : '調整なし' },
        { label: '未請求', value: `${unbilled}名`, tone: unbilled ? 'coral' : 'forest',
          hint: unbilled ? '「月謝を発行」で作られます' : '全員ぶん発行済み' },
      ]} />

      <FeeTable
        businesses={d.businesses}
        students={d.students}
        fees={d.fees}
        onPick={({ student, fee: f }) => setFee({
          studentId: student.id,
          studentName: student.name,
          parentName: student.parentName ?? null,
          yearMonth: month,
          amount: f.amount,
          baseAmount: f.baseAmount,
          status: f.status,
          paidDate: f.paidDate,
          note: f.note,
        })}
      />

      <Note>
        月謝は<strong className="text-ink">固定月額</strong>で、欠席が多くても日割りにはなりません。
        請求額は発行時にコピーして保存しているので、あとから料金を改定しても過去の月は変わりません。
        <strong className="text-ink">入金を受け取ったら、上の表の行を押して記録してください。</strong>
        記録すると保護者のマイページにもすぐ反映されます。<br />
        金額を発行時から動かすと、保護者の画面に
        <strong className="text-ink">「金額を見直しました」</strong>と出ます。
        <strong className="text-ink">理由はメモに残してください</strong>（そのまま保護者に出ます）。
      </Note>

      <FeePaymentSheet target={fee} onClose={() => setFee(null)} onSaved={state.reload} />
    </div>
  );
}
