import { Badge, DataTable, ErrorNote, Loading, Sheet, type Column } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchEmployeePayHistory } from '@/lib/queries';
import { formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import type { MonthlyPay, StaffMember } from '@/types/domain';

/**
 * 講師の詳細。月ごとの出勤数と給与を一覧で出す。
 *
 * 金額はどこにも保存されていない（ドメインルール11）。締める前は確定したコマから
 * 毎回計算した値、締めた後は payrolls に書き込まれた値が出る。
 * **同じ月でも「確定」と表示が変わったら、以後その数字は動かない。**
 */
export function StaffSheet({ staff, onClose }: { staff: StaffMember | null; onClose: () => void }) {
  const state = useAsync(
    async () => (staff ? fetchEmployeePayHistory(staff.id) : []),
    [staff?.id],
  );

  const columns: Column<MonthlyPay>[] = [
    { key: 'month', header: '月', render: (p) => formatMonthJa(p.yearMonth) },
    {
      key: 'days',
      header: '出勤',
      numeric: true,
      render: (p) => (
        <div className="tnum">
          <div>{p.workDays}日</div>
          <div className="text-[12px] text-muted">{p.slots}コマ / {p.workHours}時間</div>
        </div>
      ),
    },
    { key: 'base', header: '基本', numeric: true, render: (p) => <span className="tnum">{yen(p.baseAmount)}</span> },
    { key: 'ot', header: '時間外', numeric: true, render: (p) => <span className="tnum">{yen(p.overtime)}</span> },
    { key: 'commute', header: '交通費', numeric: true, render: (p) => <span className="tnum">{yen(p.commute)}</span> },
    {
      key: 'total',
      header: '支給額',
      numeric: true,
      render: (p) => <span className="tnum text-[14px] text-ink">{yen(p.total)}</span>,
    },
    {
      key: 'status',
      header: '状態',
      render: (p) => (
        p.status === 'confirmed'
          ? <Badge tone="success">確定</Badge>
          : <Badge tone="warn">未確定</Badge>
      ),
    },
  ];

  return (
    <Sheet
      open={Boolean(staff)}
      onClose={onClose}
      title={staff?.name ?? ''}
      subtitle={staff?.email}
    >
      {staff ? (
        <div className="space-y-lg">
          <section>
            <h4 className="mb-sm text-[13px] font-medium text-ink">現在の条件</h4>
            <dl className="grid grid-cols-2 gap-sm text-[13px]">
              <div>
                <dt className="text-[12px] text-muted">時給</dt>
                <dd className="mt-[2px] text-ink">
                  {staff.wages.length === 0
                    ? '未設定'
                    : staff.wages.map((w) => `${w.jobLabel} ${yen(w.hourlyRate)}`).join(' / ')}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">交通費（日額）</dt>
                <dd className="mt-[2px] text-ink tnum">
                  {staff.commuteDaily ? yen(staff.commuteDaily) : '未設定'}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">在籍</dt>
                <dd className="mt-[2px]">
                  {staff.active ? <Badge tone="success">在籍</Badge> : <Badge tone="neutral">退職</Badge>}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h4 className="mb-sm text-[13px] font-medium text-ink">月ごとの出勤と給与</h4>
            {state.loading && !state.data ? <Loading /> : null}
            {state.error ? <ErrorNote message={state.error} onRetry={state.reload} /> : null}
            {state.data ? (
              <DataTable
                columns={columns}
                rows={state.data}
                rowKey={(p) => p.yearMonth}
                empty="担当したコマがまだありません。スケジュールを確定すると実績になります。"
              />
            ) : null}
            <p className="mt-sm text-[12px] leading-relaxed text-muted">
              金額は保存されていません。<strong className="text-ink">確定するまでは確定済みのコマから毎回計算した値</strong>で、
              確定するとその時点の金額が記録され、以後は時給を変えても動きません。
            </p>
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}
