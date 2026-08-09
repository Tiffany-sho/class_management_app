import { useMemo, useState } from 'react';
import {
  Badge, Chip, DataTable, Icon, SectionLabel, TextInput, type Column,
} from '@/components/ui';
import { FEE_LABEL, yen } from '@/lib/format';
import type { Business, Student } from '@/types/domain';
import { isAdjusted, type StudentFee } from '@/lib/queries';

interface Row extends Student {
  fee?: StudentFee;
  businessName: string;
}

interface Props {
  businesses: Business[];
  students: Student[];
  fees: Map<string, StudentFee>;
  /** 行を押したときに開くもの。請求前（fee が無い）行は押しても何も起きない */
  onPick?: (row: { student: Student; fee: StudentFee }) => void;
}

/**
 * 月謝の支払い状況。
 *
 * 並びは**未払いが先**。この表を見るのは督促する時なので、
 * 名前順にすると探し直すことになる。
 *
 * **表の中では切り替えない。** 行を押してシートを開いてから記録する。
 * 一覧は探すために眺める場所で、そこに切り替えが並んでいると、探している途中で
 * 別の生徒を支払い済みにしてしまう。月謝には変更履歴が無いので、
 * 気づかないまま変わると誰も気づけない。
 */
export function FeeTable({ businesses, students, fees, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [biz, setBiz] = useState('all');
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const bizMap = new Map(businesses.map((b) => [b.id, b]));
    let list: Row[] = students.map((s) => ({
      ...s,
      fee: fees.get(s.id),
      businessName: bizMap.get(s.businessId)?.name ?? '—',
    }));
    if (query.trim()) {
      const q = query.trim();
      list = list.filter((s) => s.name.includes(q) || (s.parentName ?? '').includes(q));
    }
    if (biz !== 'all') list = list.filter((s) => s.businessId === biz);
    if (unpaidOnly) list = list.filter((s) => s.fee?.status !== 'paid');
    return list.sort((a, b) =>
      Number(a.fee?.status === 'paid') - Number(b.fee?.status === 'paid')
      || a.name.localeCompare(b.name, 'ja'));
  }, [businesses, students, fees, query, biz, unpaidOnly]);

  const columns: Column<Row>[] = [
    { key: 'name', header: '生徒', render: (s) => (
      <div>
        <div className="text-ink">{s.name}</div>
        <div className="text-ui-sm text-muted">{s.parentName ?? '—'}</div>
      </div>
    ) },
    { key: 'business', header: '教室', render: (s) => s.businessName },
    { key: 'course', header: 'コース', render: (s) => (
      <span className="text-ui-sm text-muted">{s.gradeLabel} 月{s.sessionsPerMonth}回</span>
    ) },
    /* 発行時から動かした月は印を付ける。**保護者の画面には「金額を見直しました」と
       出ている**ので、どの行がそうなのかを一覧で分かるようにしておく（→ FeeCard） */
    { key: 'amount', header: '請求額', numeric: true, render: (s) => (
      !s.fee ? <span className="text-muted">—</span> : (
        <div>
          <span className="tnum">{yen(s.fee.amount)}</span>
          {isAdjusted(s.fee) ? (
            <div className="text-ui-sm text-muted">調整あり</div>
          ) : null}
        </div>
      )
    ) },
    { key: 'status', header: '状況', render: (s) => (
      !s.fee ? <Badge tone="neutral">請求前</Badge>
        : <div>
            <Badge tone={s.fee.status === 'paid' ? 'success' : 'danger'}>
              {FEE_LABEL[s.fee.status]}
            </Badge>
            <div className="mt-[3px] text-ui-sm text-muted tnum">
              {s.fee.paidDate ? `入金 ${s.fee.paidDate.slice(5)}` : '入金待ち'}
            </div>
          </div>
    ) },
  ];

  return (
    <section>
      <SectionLabel>月謝の支払い状況</SectionLabel>
      <div className="mb-sm flex flex-wrap items-center gap-sm">
        <div className="relative max-w-[240px] flex-1">
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
        {businesses.map((b) => (
          <Chip key={b.id} active={biz === b.id} onClick={() => setBiz(b.id)}>{b.name}</Chip>
        ))}
        <Chip active={unpaidOnly} onClick={() => setUnpaidOnly(!unpaidOnly)}>未払いのみ</Chip>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={onPick ? (s) => { if (s.fee) onPick({ student: s, fee: s.fee }); } : undefined}
        empty="条件に合う生徒がいません。"
      />
      {onPick ? (
        <p className="mt-xs text-ui-sm text-muted">
          行を押すと<strong className="text-ink">入金を記録</strong>できます。
          「請求前」の行は、先に上の「月謝を発行」を押してください。
        </p>
      ) : null}
    </section>
  );
}
