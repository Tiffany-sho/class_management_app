import { PageHeader } from '@/components/layout/AdminLayout';
import { Badge, DataTable, Loading, ErrorNote, Note, type Column } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchAllBusinessSlots, fetchBusinesses } from '@/lib/queries';
import { WEEKDAY_JA, formatTimeRange } from '@/lib/date';
import type { BusinessSlot } from '@/types/domain';

interface Row extends BusinessSlot {
  businessName: string;
  colorKey: 'forest' | 'coral';
  perEmployee: number;
}

/**
 * 開催枠。
 *
 * 曜日とコマ時間もマスタで、コードに埋め込んでいない。
 * 日曜は2教室が同じ時間帯に並行開催されるため、スケジュールは
 * 「事業 × 日付 × コマ」で一意になっている（日付とコマ番号だけでは足りない）。
 *
 * 編集はまだ実装していない。曜日や時間を変えると過去の勤務実績の計算まで
 * 変わってしまうため、影響範囲を決めてから作る。
 */
export function MasterSlotsPage() {
  const state = useAsync(async () => {
    const [businesses, slots] = await Promise.all([fetchBusinesses(), fetchAllBusinessSlots()]);
    return { businesses, slots };
  }, []);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
  const rows: Row[] = d.slots.map((s) => ({
    ...s,
    businessName: bizMap.get(s.businessId)?.name ?? '—',
    colorKey: bizMap.get(s.businessId)?.colorKey ?? 'forest',
    perEmployee: bizMap.get(s.businessId)?.studentsPerEmployee ?? 0,
  }));

  const columns: Column<Row>[] = [
    { key: 'business', header: '事業', render: (s) => (
      <span className="inline-flex items-center gap-[6px]">
        <span
          aria-hidden
          className={`h-[9px] w-[9px] rounded-pill ${s.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
        />
        {s.businessName}
      </span>
    ) },
    { key: 'weekday', header: '曜日', render: (s) => `${WEEKDAY_JA[s.weekday]}曜` },
    { key: 'slot', header: 'コマ', render: (s) => `第${s.slotNo}コマ` },
    { key: 'time', header: '時間', render: (s) => (
      <span className="tnum">{formatTimeRange(s.startTime, s.endTime)}</span>
    ) },
    { key: 'cap', header: '定員係数', numeric: true, render: (s) => (
      <span className="tnum">講師1人につき {s.perEmployee}名</span>
    ) },
    { key: 'active', header: '状態', render: (s) => (
      s.active ? <Badge tone="success">有効</Badge> : <Badge tone="neutral">停止中</Badge>
    ) },
  ];

  return (
    <div>
      <PageHeader title="開催枠" description={`${rows.length}件`} />

      <Note>
        <strong className="text-ink">日曜は2教室が同じ時間帯に並行開催されます。</strong>
        そのためスケジュールは「事業 × 日付 × コマ」で管理していて、日付とコマ番号だけでは一意になりません。
        1コマの長さもここから取っているので、給与計算に<strong className="text-ink">90分という値をコードに書いていません</strong>。
      </Note>

      <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} empty="開催枠がありません。" />

      <p className="mt-md text-ui-sm leading-relaxed text-muted">
        ここでの編集はまだ作っていません。曜日や時間を変えると
        <strong className="text-ink">過去の勤務実績の計算まで変わる</strong>ため、
        どこまで遡って影響させるかを決めてから実装します。
        急ぐ場合は Supabase のダッシュボードから直接編集してください。
      </p>
    </div>
  );
}
