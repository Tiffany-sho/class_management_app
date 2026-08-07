import { useMemo, useState } from 'react';
import { Badge, Card, Empty, Loading, ErrorNote, Note, SectionLabel } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchMonthlyPay, fetchStaff } from '@/lib/queries';
import { currentMonthKey } from '@/lib/date';
import { yen } from '@/lib/format';
import { useAuth } from '@/features/auth/AuthProvider';
import { MonthHeader } from './MonthHeader';

/**
 * 講師の給与。
 *
 * **締めるまで金額は保存されていない。** 確定したコマから毎回計算した見込み額で、
 * 教室が締めた時点の金額が確定として記録される。
 * RLS が自分の行しか返さないので、ここで自分かどうかを条件に足さない。
 */
export function EmployeePayPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());

  const state = useAsync(async () => {
    const [businesses, pays, staff] = await Promise.all([
      fetchBusinesses(), fetchMonthlyPay(month), fetchStaff(month),
    ]);
    return { businesses, pays, staff };
  }, [month]);

  const mine = useMemo(() => {
    const d = state.data;
    if (!d) return null;
    return d.pays.find((p) => p.employeeId === user?.id) ?? null;
  }, [state.data, user?.id]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const me = d.staff.find((s) => s.id === user?.id);
  const bizMap = new Map(d.businesses.map((b) => [b.id, b.name]));

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth}>
        {mine ? (
          <div className="mt-sm text-center">
            <div className="text-[28px] font-medium text-ink tnum">{yen(mine.total)}</div>
            <div className="mt-[2px]">
              {mine.status === 'confirmed'
                ? <Badge tone="success">確定</Badge>
                : <Badge tone="warn">見込み（未確定）</Badge>}
            </div>
          </div>
        ) : (
          <div className="mt-sm text-center text-[13px] text-muted">この月の勤務はありません</div>
        )}
        <p className="mt-xs text-center text-[11px] text-muted">左右に払うと月を移せます</p>
      </MonthHeader>

      <SectionLabel>今月の内訳</SectionLabel>
      <Card className="mb-md">
        {!mine ? (
          <Empty
            title="確定したコマがありません。"
            hint="スケジュールが確定すると勤務実績になり、ここに金額が出ます。"
          />
        ) : (
          <dl className="divide-y divide-hairline">
            {([
              ['出勤日数', `${mine.workDays}日`],
              ['コマ数', `${mine.slots}コマ`],
              ['勤務時間', `${mine.workHours}時間`],
              ['基本給', yen(mine.baseAmount)],
              ['時間外（承認済み）', yen(mine.overtime)],
              ['交通費', yen(mine.commute)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-md py-sm">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="text-[14px] text-ink tnum">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between px-md py-sm">
              <dt className="text-[14px] font-medium text-ink">支給額</dt>
              <dd className="text-[16px] font-medium text-ink tnum">{yen(mine.total)}</dd>
            </div>
          </dl>
        )}
      </Card>

      <SectionLabel>時給・交通費</SectionLabel>
      <Card className="mb-md">
        {!me || (me.wages.length === 0 && !me.commuteDaily) ? (
          <Empty title="時給がまだ設定されていません。" hint="教室にお問い合わせください。" />
        ) : (
          <dl className="divide-y divide-hairline">
            {me.wages.map((w) => (
              <div key={`${w.businessId}${w.jobLabel}`} className="flex items-center justify-between px-md py-sm">
                <dt className="text-[13px] text-muted">
                  {w.jobLabel}
                  <span className="ml-xs text-[11px]">（{bizMap.get(w.businessId) ?? '—'}）</span>
                </dt>
                <dd className="text-[14px] text-ink tnum">{yen(w.hourlyRate)} / 時</dd>
              </div>
            ))}
            <div className="flex items-center justify-between px-md py-sm">
              <dt className="text-[13px] text-muted">交通費（1日）</dt>
              <dd className="text-[14px] text-ink tnum">{yen(me.commuteDaily)}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Note>
        {mine?.status === 'confirmed' ? (
          <>この月は<strong className="text-ink">確定済み</strong>です。以後、時給が変わってもこの金額は動きません。</>
        ) : (
          <>
            <strong className="text-ink">確定するまでは見込み額</strong>です。
            確定したコマから計算しているので、担当が増えれば金額も変わります。
            交通費は<strong className="text-ink">出勤した日数ぶん</strong>で、
            同じ日に2教室を担当しても1日ぶんです。
          </>
        )}
      </Note>
    </div>
  );
}
