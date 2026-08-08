import { useState } from 'react';
import { Badge, Button, Empty, Loading, ErrorNote, Note, Sheet } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { confirmPayroll, fetchEmployeeWorkSlots } from '@/lib/queries';
import { formatDayJa, formatMonthJa } from '@/lib/date';
import { yen } from '@/lib/format';
import type { Business, MonthlyPay } from '@/types/domain';

interface Props {
  /** null なら閉じている */
  target: (MonthlyPay & { employeeName: string }) | null;
  month: string;
  businesses: Business[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * その月の出勤状況と、支給額の内訳。
 *
 * **この一覧が給与の根拠そのもの**。確定したコマ = 勤務実績なので、
 * 金額が思っていたのと違うときは、必ずここのコマの数を先に見る。
 * 急な欠勤で担当を外した回はこの一覧から消え、そのぶん金額も下がる。
 *
 * 締めるのはここからもできる。急な欠勤で出勤が変わった人を後回しにして、
 * 確定できる人だけ先に締められるようにするため。
 */
export function PayrollSheet({ target, month, businesses, onClose, onSaved, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const employeeId = target?.employeeId;

  const state = useAsync(
    async () => (employeeId ? fetchEmployeeWorkSlots(month, employeeId) : []),
    [month, employeeId],
  );

  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const slots = state.data ?? [];
  const confirmed = target?.status === 'confirmed';

  const close = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const n = await confirmPayroll(month, target.employeeId);
      onSaved(n === 0
        ? 'この講師には締める対象がありません。'
        : `${target.employeeName} の${formatMonthJa(month)}ぶんを確定しました`);
    } catch (e) {
      onError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /* 日ごとにまとめる。交通費は「出勤した日」に対する日額なので、
     コマを数えても交通費の根拠にならない（日曜に2コマ入っても1日ぶん）。 */
  const days = [...new Set(slots.map((s) => s.sessionDate))];

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `${target.employeeName} の出勤状況` : ''}
      subtitle={formatMonthJa(month)}
      footer={
        <>
          <Button block onClick={onClose}>閉じる</Button>
          {target && !confirmed ? (
            <Button variant="primary" block disabled={busy} onClick={() => void close()}>
              この講師を確定する
            </Button>
          ) : null}
        </>
      }
    >
      {target ? (
        <>
          <div className="mb-lg grid grid-cols-3 gap-xs">
            {[
              { label: '出勤', value: `${target.workDays}日` },
              { label: 'コマ', value: `${target.slots}コマ` },
              { label: '勤務時間', value: `${Math.round(target.workHours * 10) / 10}時間` },
            ].map((x) => (
              <div key={x.label} className="rounded-md border border-hairline px-sm py-xs">
                <div className="text-ui-xs text-muted">{x.label}</div>
                <div className="text-ui-lg text-ink tnum">{x.value}</div>
              </div>
            ))}
          </div>

          <dl className="mb-lg rounded-md border border-hairline">
            {[
              { label: '基本給（コマから計算）', value: target.baseAmount },
              { label: '時間外', value: target.overtime },
              { label: `交通費（${days.length}日ぶん）`, value: target.commute },
            ].map((x) => (
              <div key={x.label} className="flex items-center gap-sm border-b border-hairline px-md py-xs">
                <dt className="flex-1 text-ui-base text-muted">{x.label}</dt>
                <dd className="text-ui-md text-ink tnum">{yen(x.value)}</dd>
              </div>
            ))}
            <div className="flex items-center gap-sm px-md py-sm">
              <dt className="flex-1 text-ui-base text-ink">支給額</dt>
              <dd className="text-ui-xl font-medium text-ink tnum">{yen(target.total)}</dd>
            </div>
          </dl>

          <div className="mb-xs flex items-center gap-xs">
            <h4 className="text-ui-base font-medium text-ink">出勤したコマ</h4>
            <span className="flex-1" />
            {confirmed ? (
              <Badge tone="success">確定済み</Badge>
            ) : (
              <Badge tone="warn">未確定</Badge>
            )}
          </div>

          {state.loading && !state.data ? (
            <Loading />
          ) : state.error ? (
            <ErrorNote message={state.error} onRetry={state.reload} />
          ) : slots.length === 0 ? (
            <Empty
              title="この月に確定したコマがありません。"
              hint="スケジュールを確定すると勤務実績になります。"
            />
          ) : (
            <ul className="rounded-md border border-hairline">
              {slots.map((s) => {
                const b = bizMap.get(s.businessId);
                return (
                  <li
                    key={`${s.scheduleId}`}
                    className="flex flex-wrap items-center gap-xs border-b border-hairline
                      px-md py-xs last:border-0"
                  >
                    <span
                      aria-hidden
                      className={`h-[9px] w-[9px] rounded-pill ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                    />
                    <span className="text-ui-base text-ink">{formatDayJa(s.sessionDate)}</span>
                    <span className="text-ui-sm text-muted">
                      {b?.name?.replace('教室', '') ?? '—'} 第{s.slotNo}コマ
                    </span>
                    <span className="flex-1" />
                    <span className="text-ui-sm text-muted tnum">
                      {s.hours}時間 × {yen(s.hourlyRate)}
                    </span>
                    <span className="w-[72px] text-right text-ui-base text-ink tnum">
                      {yen(s.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <Note icon={confirmed ? 'info' : 'warning'}>
            {confirmed ? (
              <>
                この月は確定済みです。<strong className="text-ink">上の金額は payrolls に記録された値</strong>で、
                いま時給やコマを直しても動きません。確定日は {target.confirmedAt?.slice(0, 10) ?? '—'} です。
              </>
            ) : (
              <>
                <strong className="text-ink">この一覧が給与の根拠です。</strong>
                急な欠勤で担当を外した回はここから消え、そのぶん金額も下がります。
                「当日の変更」で担当を直してから確定してください。
                <strong className="text-ink">確定すると、その時点の金額が記録されて以後は動かなくなります。</strong>
              </>
            )}
          </Note>
        </>
      ) : null}
    </Sheet>
  );
}
