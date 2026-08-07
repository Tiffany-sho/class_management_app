import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Button, DataTable, Loading, ErrorNote, MonthNav, Note, useToast, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { confirmPayroll, fetchEmployees, fetchMonthlyPay } from '@/lib/queries';
import { currentMonthKey, formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import type { MonthlyPay } from '@/types/domain';
import { StatCards } from '../revenue/StatCards';

interface Row extends MonthlyPay {
  employeeName: string;
}

/**
 * 給与計算・締め処理。
 *
 * **締めるまで金額はどこにも保存されない**（ドメインルール11）。
 * 表に出ているのは確定したコマから毎回計算した値で、時給を直せばこの数字も変わる。
 * 「締める」を押した時点の金額が payrolls にコピーされ、以後は動かなくなる。
 * 確定済みの行は DB のトリガーが更新・削除を拒む。
 */
export function PayrollPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    const [employees, pays] = await Promise.all([fetchEmployees(), fetchMonthlyPay(month)]);
    return { employees, pays };
  }, [month]);

  const rows = useMemo<Row[]>(() => {
    const d = state.data;
    if (!d) return [];
    const nameMap = new Map(d.employees.map((e) => [e.id, e.name]));
    return d.pays
      .map((p) => ({ ...p, employeeName: nameMap.get(p.employeeId) ?? '—' }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ja'));
  }, [state.data]);

  const close = async () => {
    setBusy(true);
    try {
      const n = await confirmPayroll(month);
      toast(n === 0
        ? 'この月に締める対象がありません。'
        : `${formatMonthJa(month)}の給与を確定しました（${n}名）`);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  const draftCount = rows.filter((p) => p.status === 'draft').length;
  const total = rows.reduce((a, p) => a + p.total, 0);
  const days = rows.reduce((a, p) => a + p.workDays, 0);
  const hours = rows.reduce((a, p) => a + p.workHours, 0);

  const columns: Column<Row>[] = [
    { key: 'name', header: '講師', render: (p) => <span className="text-ink">{p.employeeName}</span> },
    { key: 'days', header: '出勤', numeric: true, render: (p) => (
      <div className="tnum">
        <div>{p.workDays}日</div>
        <div className="text-[12px] text-muted">{p.slots}コマ / {p.workHours}時間</div>
      </div>
    ) },
    { key: 'base', header: '基本', numeric: true, render: (p) => <span className="tnum">{yen(p.baseAmount)}</span> },
    { key: 'ot', header: '時間外', numeric: true, render: (p) => (
      p.overtime
        ? <span className="tnum">{yen(p.overtime)}</span>
        : <span className="text-muted">—</span>
    ) },
    { key: 'commute', header: '交通費', numeric: true, render: (p) => <span className="tnum">{yen(p.commute)}</span> },
    { key: 'total', header: '支給額', numeric: true, render: (p) => (
      <span className="tnum text-[15px] text-ink">{yen(p.total)}</span>
    ) },
    { key: 'status', header: '状態', render: (p) => (
      p.status === 'confirmed'
        ? <div>
            <Badge tone="success">確定</Badge>
            {p.confirmedAt ? (
              <div className="mt-[3px] text-[11px] text-muted tnum">{p.confirmedAt.slice(0, 10)}</div>
            ) : null}
          </div>
        : <Badge tone="warn">未確定</Badge>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="給与計算・締め処理"
        actions={
          <div className="flex items-center gap-sm">
            <MonthNav value={month} onChange={setMonth} />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || draftCount === 0}
              onClick={() => void close()}
            >
              {draftCount === 0 ? 'すべて確定済み' : `${draftCount}名ぶんを確定する`}
            </Button>
          </div>
        }
      />

      <StatCards stats={[
        { label: '支給額の合計', value: yen(total) },
        { label: '出勤日数', value: `${days}日` },
        { label: '勤務時間', value: `${Math.round(hours * 10) / 10}時間` },
        { label: '未確定', value: `${draftCount}名`, tone: draftCount ? 'coral' : 'forest' },
      ]} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.employeeId}
        empty="この月に確定したコマがありません。スケジュールを確定すると勤務実績になります。"
      />

      <Note icon={draftCount ? 'warning' : 'info'}>
        {draftCount ? (
          <>
            <strong className="text-ink">確定すると、その時点の金額が記録されて以後は動かなくなります。</strong>
            時給や交通費を直す予定があるなら、確定する前に済ませてください。
            確定した行は DB 側で更新・却下されるので、あとから戻せません。
          </>
        ) : (
          <>
            この月はすべて確定済みです。<strong className="text-ink">時給を改定しても、この月の金額は変わりません。</strong>
            確定した金額は監査のために固定しています。
          </>
        )}
      </Note>
    </div>
  );
}
