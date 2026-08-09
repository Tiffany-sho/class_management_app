import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Loading, ErrorNote, MonthNav, Note } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchBusinesses, fetchFees, fetchMonthlyPay, fetchStudents, fetchWorkSlotSummary,
} from '@/lib/queries';
import { currentMonthKey } from '@/lib/date';
import { yen } from '@/lib/format';
import { StatCards } from './StatCards';
import { BusinessBreakdown } from './BusinessBreakdown';

/**
 * 収入・収益。
 *
 * 収入は月謝（固定月額）の合計、支出は**確定したコマから計算した人件費**。
 * どちらも他の画面と同じデータを見ているので数字が食い違わない。
 *
 * **1件ずつの入金記録はここに置かない**（→ features/fees）。ここは「今月いくら
 * 残ったか」を見る画面で、月に一度あれば足りる。督促のたびに収支の数字を
 * かき分けて表まで下りることになっていた。
 */
export function RevenuePage() {
  const [month, setMonth] = useState(currentMonthKey());

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
        description="月謝の請求額と人件費の差引。"
        actions={<MonthNav value={month} onChange={setMonth} />}
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

      {/* **未請求が残っていると収入が小さく出る。** 数字を見て「減った」と読む前に、
          発行し忘れかどうかが分かるようにしておく */}
      <Note icon={unbilled ? 'warning' : 'info'}>
        {unbilled ? (
          <>
            <strong className="text-ink">この月はまだ {unbilled}名ぶんの月謝を発行していません。</strong>
            そのぶん収入が小さく出ています。
            <Link to="/fees" className="text-primary underline">月謝</Link>から発行してください。<br />
          </>
        ) : null}
        入金の記録・金額の調整は<Link to="/fees" className="text-primary underline">月謝</Link>で行います。
        人件費は<strong className="text-ink">確定したコマから計算した見込み</strong>で、
        締めると<code>payrolls</code>に記録した金額が正になります。
      </Note>
    </div>
  );
}
