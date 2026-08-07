import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Button, Chip, DataTable, Icon, Loading, ErrorNote, MonthNav, Note, Panel,
  SectionLabel, TextInput, useToast, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  fetchBusinesses, fetchFees, fetchMonthlyPay, fetchStudents, fetchWorkSlotSummary,
  generateFees, type StudentFee,
} from '@/lib/queries';
import { currentMonthKey, formatMonthJa } from '@/lib/date';
import { FEE_LABEL, yen } from '@/lib/format';
import type { Student } from '@/types/domain';
import { StatCards } from './StatCards';

interface Row extends Student {
  fee?: StudentFee;
  businessName: string;
}

/**
 * 収入・収益。
 *
 * 収入は月謝（固定月額）の合計、支出は**確定したコマから計算した人件費**。
 * どちらも他の画面と同じデータを見ているので数字が食い違わない。
 *
 * 交通費と時間外は事業に割り振らない（交通費は出勤「日」に対する日額で、
 * 日曜の掛け持ちでも1日ぶん。按分の根拠が無いものを勝手に配分しない）。
 */
export function RevenuePage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [biz, setBiz] = useState('all');
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  const state = useAsync(async () => {
    const [businesses, students, fees, workByBiz, pays] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchFees(month),
      fetchWorkSlotSummary(month), fetchMonthlyPay(month),
    ]);
    return { businesses, students, fees, workByBiz, pays };
  }, [month]);

  const rows = useMemo<Row[]>(() => {
    const d = state.data;
    if (!d) return [];
    const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
    let list: Row[] = d.students.map((s) => ({
      ...s,
      fee: d.fees.get(s.id),
      businessName: bizMap.get(s.businessId)?.name ?? '—',
    }));
    if (query.trim()) {
      const q = query.trim();
      list = list.filter((s) => s.name.includes(q) || (s.parentName ?? '').includes(q));
    }
    if (biz !== 'all') list = list.filter((s) => s.businessId === biz);
    if (unpaidOnly) list = list.filter((s) => s.fee?.status !== 'paid');
    // 未払いを先に。督促する側が見たい順
    return list.sort((a, b) =>
      Number(a.fee?.status === 'paid') - Number(b.fee?.status === 'paid')
      || a.name.localeCompare(b.name, 'ja'));
  }, [state.data, query, biz, unpaidOnly]);

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

  const columns: Column<Row>[] = [
    { key: 'name', header: '生徒', render: (s) => (
      <div>
        <div className="text-ink">{s.name}</div>
        <div className="text-[12px] text-muted">{s.parentName ?? '—'}</div>
      </div>
    ) },
    { key: 'business', header: '教室', render: (s) => s.businessName },
    { key: 'course', header: 'コース', render: (s) => (
      <span className="text-[12px] text-muted">{s.gradeLabel} 月{s.sessionsPerMonth}回</span>
    ) },
    { key: 'amount', header: '請求額', numeric: true, render: (s) => (
      s.fee ? <span className="tnum">{yen(s.fee.amount)}</span> : <span className="text-muted">—</span>
    ) },
    { key: 'status', header: '状況', render: (s) => (
      !s.fee ? <Badge tone="neutral">請求前</Badge>
        : <div>
            <Badge tone={s.fee.status === 'paid' ? 'success' : 'danger'}>
              {FEE_LABEL[s.fee.status]}
            </Badge>
            <div className="mt-[3px] text-[12px] text-muted tnum">
              {s.fee.paidDate ? `入金 ${s.fee.paidDate.slice(5)}` : '入金待ち'}
            </div>
          </div>
    ) },
  ];

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

      <div className="grid gap-lg app:grid-cols-2">
        <div>
          <SectionLabel>事業別の内訳</SectionLabel>
          <Panel className="p-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline text-[12px] text-muted">
                  <th className="px-md py-sm text-left font-medium">事業</th>
                  <th className="px-md py-sm text-right font-medium">生徒</th>
                  <th className="px-md py-sm text-right font-medium">月謝収入</th>
                  <th className="px-md py-sm text-right font-medium">コマ人件費</th>
                  <th className="px-md py-sm text-right font-medium">差引</th>
                </tr>
              </thead>
              <tbody>
                {d.businesses.map((b) => {
                  const heads = d.students.filter((s) => s.businessId === b.id);
                  const inc = heads.reduce((a, s) => a + (d.fees.get(s.id)?.amount ?? 0), 0);
                  const cost = d.workByBiz.get(b.id)?.amount ?? 0;
                  return (
                    <tr key={b.id} className="border-b border-hairline last:border-0">
                      <td className="px-md py-sm">
                        <span className="inline-flex items-center gap-[6px]">
                          <span
                            aria-hidden
                            className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                          />
                          {b.name}
                        </span>
                      </td>
                      <td className="px-md py-sm text-right tnum">{heads.length}名</td>
                      <td className="px-md py-sm text-right tnum">{yen(inc)}</td>
                      <td className="px-md py-sm text-right tnum">{yen(cost)}</td>
                      <td className="px-md py-sm text-right tnum text-ink">{yen(inc - cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <p className="mt-sm text-[12px] leading-relaxed text-muted">
            事業別の人件費は<strong className="text-ink">コマから計算した基本給だけ</strong>です。
            交通費は出勤「日」に対する日額（日曜に2教室を掛け持ちしても1日ぶん）、
            時間外はシフト外の作業なので、<strong className="text-ink">どちらも事業に割り振っていません</strong>。
            上の「人件費」はそれらを含んだ全体の金額です。
          </p>
        </div>

        <div>
          <SectionLabel>月謝の支払い状況</SectionLabel>
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <div className="relative max-w-[200px] flex-1">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-muted"
              />
              <TextInput
                className="pl-[32px]"
                placeholder="生徒・保護者を検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Chip active={biz === 'all'} onClick={() => setBiz('all')}>すべて</Chip>
            {d.businesses.map((b) => (
              <Chip key={b.id} active={biz === b.id} onClick={() => setBiz(b.id)}>{b.name}</Chip>
            ))}
            <Chip active={unpaidOnly} onClick={() => setUnpaidOnly(!unpaidOnly)}>未払いのみ</Chip>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            empty="条件に合う生徒がいません。"
          />
        </div>
      </div>

      <Note>
        月謝は<strong className="text-ink">固定月額</strong>で、欠席が多くても日割りにはなりません。
        請求額は発行時にコピーして保存しているので、あとから料金を改定しても過去の月は変わりません。
      </Note>
    </div>
  );
}
