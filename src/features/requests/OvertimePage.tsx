import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Button, Chip, DataTable, Loading, ErrorNote, Note, useToast, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { decideOvertime, fetchOvertimeRequests } from '@/lib/queries';
import { formatDayJa } from '@/lib/date';
import { yen } from '@/lib/format';
import type { OvertimeRequest, RequestStatus } from '@/types/domain';

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下',
};

/**
 * 時間外勤務の申請。
 *
 * **承認した分だけが給与に加算される。** 割増は付かない（1日8h・週40h超の25%割増は別物で、
 * ここで扱っているのはシフト外に行った作業に通常時給を払うもの）。
 * 決裁は記録に残り、決裁後は本人も編集できなくなる。
 */
export function OvertimePage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<RequestStatus | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(fetchOvertimeRequests, []);

  const counts = useMemo(() => {
    const list = state.data ?? [];
    return {
      pending: list.filter((o) => o.status === 'pending').length,
      approved: list.filter((o) => o.status === 'approved').length,
      rejected: list.filter((o) => o.status === 'rejected').length,
    };
  }, [state.data]);

  const rows = useMemo(() => {
    const list = state.data ?? [];
    return filter === 'all' ? list : list.filter((o) => o.status === filter);
  }, [state.data, filter]);

  const decide = async (o: OvertimeRequest, approve: boolean) => {
    setBusy(o.id);
    try {
      await decideOvertime(o.id, approve);
      toast(
        approve
          ? `${o.employeeName} の申請を承認しました（${yen(o.amount)} を加算）`
          : `${o.employeeName} の申請を却下しました`,
      );
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  const columns: Column<OvertimeRequest>[] = [
    { key: 'employee', header: '講師', render: (o) => <span className="text-ink">{o.employeeName}</span> },
    { key: 'date', header: '勤務日', render: (o) => formatDayJa(o.workDate) },
    {
      key: 'desc',
      header: '作業内容',
      /* ここだけ自由記述。長くなるので折り返しを許す（読みやすい幅で折る） */
      wrap: true,
      render: (o) => (
        <div>
          <div className="text-ink">{o.description}</div>
          <div className="text-ui-sm text-muted">{o.businessName}</div>
        </div>
      ),
    },
    { key: 'hours', header: '申請時間', numeric: true, render: (o) => <span className="tnum">{o.hours.toFixed(1)}h</span> },
    {
      key: 'rate',
      header: '適用時給',
      numeric: true,
      render: (o) => (
        o.hourlyRate
          ? <span className="tnum">{yen(o.hourlyRate)}</span>
          : <span className="text-ui-sm text-coral">時給未設定</span>
      ),
    },
    {
      key: 'amount',
      header: '加算額',
      numeric: true,
      render: (o) => <span className="tnum text-ink">{yen(o.amount)}</span>,
    },
    {
      key: 'status',
      header: '状態',
      render: (o) => (
        <div>
          <Badge tone={o.status === 'approved' ? 'success' : o.status === 'rejected' ? 'neutral' : 'warn'}>
            {STATUS_LABEL[o.status]}
          </Badge>
          {o.decidedByName ? (
            <div className="mt-[3px] text-ui-xs text-muted">{o.decidedByName}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (o) => (
        o.status === 'pending' ? (
          <div className="flex gap-xs">
            <Button size="sm" onClick={() => void decide(o, true)} disabled={busy === o.id}>
              承認
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void decide(o, false)} disabled={busy === o.id}>
              却下
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="時間外勤務 申請"
        description="シフト外に行った勤務です。承認した分だけが給与に加算されます。"
      />

      <div className="mb-md flex flex-wrap gap-xs">
        <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>
          承認待ち {counts.pending}
        </Chip>
        <Chip active={filter === 'approved'} onClick={() => setFilter('approved')}>
          承認済み {counts.approved}
        </Chip>
        <Chip active={filter === 'rejected'} onClick={() => setFilter('rejected')}>
          却下 {counts.rejected}
        </Chip>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>すべて</Chip>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        empty={
          filter === 'pending'
            ? '承認待ちの申請はありません。'
            : '該当する申請はありません。'
        }
      />

      <Note>
        <strong className="text-ink">法定残業（1日8時間・週40時間を超えた分の25%割増）とは別物</strong>です。
        加算単価はその日に適用されていた通常時給で、割増は付きません。
        「時給未設定」と出ている場合は加算額が 0 になるので、先に講師の時給を登録してください。
      </Note>
    </div>
  );
}
