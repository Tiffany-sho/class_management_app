import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Button, Loading, ErrorNote, MonthNav, Note, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  fetchBusinesses, fetchFees, fetchMonthlyPay, fetchStudents, fetchWorkSlotSummary,
  generateFees,
} from '@/lib/queries';
import { currentMonthKey, formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import { StatCards } from './StatCards';
import { BusinessBreakdown } from './BusinessBreakdown';
import { FeeTable } from './FeeTable';
import { FeePaymentSheet, type FeeTarget } from './FeePaymentSheet';

/**
 * 収入・収益。
 *
 * 収入は月謝（固定月額）の合計、支出は**確定したコマから計算した人件費**。
 * どちらも他の画面と同じデータを見ているので数字が食い違わない。
 *
 * 2つの表は**必ず縦に並べる**。横に並べると片方が狭くなり、
 * 金額の桁が折り返して比べられなくなる。
 */
export function RevenuePage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState<FeeTarget | null>(null);

  const state = useAsync(async () => {
    const [businesses, students, fees, workByBiz, pays] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchFees(month),
      fetchWorkSlotSummary(month), fetchMonthlyPay(month),
    ]);
    return { businesses, students, fees, workByBiz, pays };
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

  const income = [...d.fees.values()].reduce((a, f) => a + f.amount, 0);
  const collected = [...d.fees.values()].reduce((a, f) => a + (f.status === 'paid' ? f.amount : 0), 0);
  const labor = d.pays.reduce((a, p) => a + p.total, 0);
  const commute = d.pays.reduce((a, p) => a + p.commute, 0);
  const overtime = d.pays.reduce((a, p) => a + p.overtime, 0);
  const profit = income - labor;
  const anyConfirmed = d.pays.some((p) => p.status === 'confirmed');
  const unbilled = d.students.filter((s) => !d.fees.has(s.id)).length;

  return (
    <div>
      <PageHeader
        title="収入・収益"
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

      <StatCards stats={[
        { label: '月謝収入（請求ベース）', value: yen(income),
          hint: `入金済み ${yen(collected)}` },
        { label: '人件費', value: yen(labor), tone: 'coral',
          hint: `交通費 ${yen(commute)} / 時間外 ${yen(overtime)}` },
        { label: '差引', value: yen(profit), tone: profit >= 0 ? 'forest' : 'coral' },
        { label: '利益率', value: income ? `${Math.round((profit / income) * 100)}%` : '—',
          hint: anyConfirmed ? '給与は確定済み' : '給与は未確定（計算値）' },
      ]} />

      <BusinessBreakdown
        businesses={d.businesses}
        students={d.students}
        fees={d.fees}
        costByBusiness={d.workByBiz}
      />

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
          status: f.status,
          paidDate: f.paidDate,
          note: f.note,
        })}
      />

      <Note>
        月謝は<strong className="text-ink">固定月額</strong>で、欠席が多くても日割りにはなりません。
        請求額は発行時にコピーして保存しているので、あとから料金を改定しても過去の月は変わりません。
        <strong className="text-ink">入金を受け取ったら、上の表の行を押して記録してください。</strong>
        記録すると保護者のマイページにもすぐ反映されます。
      </Note>

      <FeePaymentSheet target={fee} onClose={() => setFee(null)} onSaved={state.reload} />
    </div>
  );
}
