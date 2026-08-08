import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Chip, DataTable, Icon, Loading, ErrorNote, Note, TextInput, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchStaff } from '@/lib/queries';
import { currentMonthKey, formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import type { Business, StaffMember } from '@/types/domain';
import { StaffSheet } from './StaffSheet';

/**
 * 講師一覧。
 *
 * 時給・交通費は**今日の時点で適用中のもの**を出す。履歴を持っているので、
 * 過去の給与はこの数字では計算されない（勤務日ごとの時給で計算される）。
 * 今月の担当はスケジュール確定で割り当てた**確定済みのコマ**から自動集計している。
 */
export function StaffPage() {
  const month = currentMonthKey();
  const [query, setQuery] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const state = useAsync(async () => {
    const [businesses, staff] = await Promise.all([fetchBusinesses(), fetchStaff(month)]);
    return { businesses, staff };
  }, [month]);

  const rows = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    let list = d.staff;
    if (!showRetired) list = list.filter((s) => s.active);
    if (query.trim()) list = list.filter((s) => s.name.includes(query.trim()));
    return list;
  }, [state.data, query, showRetired]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map<string, Business>(d.businesses.map((b) => [b.id, b]));

  const columns: Column<StaffMember>[] = [
    {
      key: 'name',
      header: '講師',
      render: (s) => (
        <div>
          <div className="text-ui-md text-ink">{s.name}</div>
          <div className="text-ui-sm text-muted">{s.email}</div>
        </div>
      ),
    },
    {
      key: 'business',
      header: '担当事業',
      render: (s) => (
        <div className="flex flex-wrap gap-[4px]">
          {s.businessIds.length === 0 ? <span className="text-ui-sm text-muted">未設定</span> : null}
          {s.businessIds.map((id) => {
            const b = bizMap.get(id);
            return (
              <Badge key={id} tone={b?.colorKey === 'forest' ? 'prog' : 'illust'}>
                {b?.name ?? '—'}
              </Badge>
            );
          })}
        </div>
      ),
    },
    {
      key: 'wage',
      header: '時給（現在）',
      render: (s) => (
        s.wages.length === 0
          ? <span className="text-ui-sm text-muted">未設定</span>
          : (
            <div className="space-y-[2px]">
              {s.wages.map((w) => (
                <div key={`${w.businessId}${w.jobLabel}`} className="text-ui-sm tnum">
                  <span className="text-muted">{w.jobLabel}</span>{' '}
                  <span className="text-ink">{yen(w.hourlyRate)}</span>
                </div>
              ))}
            </div>
          )
      ),
    },
    {
      key: 'commute',
      header: '交通費（日額）',
      numeric: true,
      render: (s) => (
        s.commuteDaily
          ? <span className="tnum">{yen(s.commuteDaily)}</span>
          : <span className="text-muted">未設定</span>
      ),
    },
    {
      key: 'slots',
      header: `${formatMonthJa(month)}の担当`,
      numeric: true,
      render: (s) => (
        <div className="tnum">
          <div className="text-ink">{s.monthSlots}コマ</div>
          <div className="text-ui-sm text-muted">{s.monthHours}時間 / {s.monthDays}日</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状態',
      render: (s) => (
        s.active ? <Badge tone="success">在籍</Badge> : <Badge tone="neutral">退職</Badge>
      ),
    },
    {
      key: 'go',
      header: '',
      render: () => <Icon name="chevron-right" size={16} className="text-border-strong" />,
    },
  ];

  return (
    <div>
      <PageHeader title="講師" description={`${rows.length} / ${d.staff.length}名`} />

      <div className="mb-md flex flex-wrap items-center gap-sm">
        <div className="relative max-w-[240px] flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            className="pl-[32px]"
            placeholder="講師を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-xs">
          <Chip active={!showRetired} onClick={() => setShowRetired(false)}>在籍のみ</Chip>
          <Chip active={showRetired} onClick={() => setShowRetired(true)}>退職を含む</Chip>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={setSelected}
        empty={
          d.staff.length === 0
            ? '講師がまだ登録されていません。ユーザー・招待から登録してください。'
            : '条件に合う講師がいません。'
        }
      />

      <Note>
        時給は<strong className="text-ink">「講師 × 事業」ごとに適用開始日つき</strong>で持っているため、
        昇給しても過去の給与はさかのぼって変わりません。ここに出ているのは今日時点の金額です。
        退職は論理削除で、担当したコマの記録は残ります。
      </Note>

      <StaffSheet
        staff={selected}
        businesses={d.businesses}
        onClose={() => setSelected(null)}
        onSaved={() => { setSelected(null); state.reload(); }}
      />
    </div>
  );
}
