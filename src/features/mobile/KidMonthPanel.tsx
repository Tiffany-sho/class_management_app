import { Badge, Card, Empty, Icon } from '@/components/ui';
import { useSwipeMonth } from '@/hooks/useSwipeMonth';
import { formatDayJa, formatMonthJa, formatTimeRange, shiftMonth } from '@/lib/date';
import { ATTENDANCE_LABEL, FEE_LABEL, attendanceTone } from '@/lib/format';
import type { AttendanceStatus, BusinessColorKey, FeeStatus } from '@/types/domain';

export interface KidSession {
  key: string;
  sessionDate: string;
  slotNo: number;
  startTime: string;
  endTime: string;
  colorKey: BusinessColorKey;
  employeeNames: string[];
  past: boolean;
  attendanceStatus: AttendanceStatus | null;
  note: string | null;
  notedByName: string | null;
}

interface Props {
  studentName: string;
  month: string;
  onMonth: (m: string) => void;
  sessions: KidSession[];
  fee: { amount: number; status: FeeStatus; paidDate: string | null } | null;
}

/**
 * 受講状況（保護者ホームの中心）。
 *
 * **出欠と授業記録を同じ行に出す。** 別のセクションに分けると、
 * 「どの回の記録か」を保護者が突き合わせることになり、食い違っても気づけない。
 *
 * 出席率は出さない。月2〜3回しか通わないので、1回休むと 67% になり実態より悪く見える。
 * 回数と1件ずつの記録だけを出す。
 */
export function KidMonthPanel({ studentName, month, onMonth, sessions, fee }: Props) {
  const ref = useSwipeMonth<HTMLDivElement>((d) => onMonth(shiftMonth(month, d)));
  const done = sessions.filter((s) => s.past).length;

  return (
    <Card className="mb-md">
      <div ref={ref}>
        <div className="flex items-center gap-xs border-b border-hairline px-md py-sm">
          <h3 className="text-[14px] font-medium text-ink">受講状況</h3>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="前の月"
            onClick={() => onMonth(shiftMonth(month, -1))}
            className="grid h-7 w-7 place-items-center rounded-pill border border-hairline text-ink"
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="min-w-[92px] text-center text-[14px] text-ink tnum">
            {formatMonthJa(month)}
          </span>
          <button
            type="button"
            aria-label="次の月"
            onClick={() => onMonth(shiftMonth(month, 1))}
            className="grid h-7 w-7 place-items-center rounded-pill border border-hairline text-ink"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-xs border-b border-hairline px-md py-xs
          text-[12px] text-muted">
          <span>済んだ授業 <strong className="text-ink tnum">{done}</strong></span>
          <span>これから <strong className="text-ink tnum">{sessions.length - done}</strong></span>
          <span className="flex-1" />
          <span className="flex items-center gap-[6px]">
            月謝
            {!fee ? (
              <Badge tone="neutral">請求前</Badge>
            ) : (
              <>
                <Badge tone={fee.status === 'paid' ? 'success' : 'danger'}>
                  {FEE_LABEL[fee.status]}
                </Badge>
                <span className="tnum">{fee.paidDate ? `入金 ${fee.paidDate.slice(5)}` : '入金待ち'}</span>
              </>
            )}
          </span>
        </div>

        {sessions.length === 0 ? (
          <Empty title={`${formatMonthJa(month)}に${studentName}さんの受講予定はありません。`} />
        ) : (
          <ul>
            {sessions.map((s) => (
              <li key={s.key} className="border-b border-hairline px-md py-sm last:border-0">
                <div className="flex flex-wrap items-center gap-xs">
                  <span
                    aria-hidden
                    className={`h-[9px] w-[9px] rounded-pill ${s.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                  />
                  <span className="text-[14px] text-ink">{formatDayJa(s.sessionDate)}</span>
                  <span className="text-[12px] text-muted">第{s.slotNo}コマ</span>
                  <span className="flex-1" />
                  {!s.past ? (
                    <Badge tone="info">予定</Badge>
                  ) : s.attendanceStatus ? (
                    <Badge tone={attendanceTone(s.attendanceStatus)}>
                      {ATTENDANCE_LABEL[s.attendanceStatus]}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">記録待ち</Badge>
                  )}
                </div>

                <div className="mt-[3px] text-[12px] text-muted tnum">
                  {formatTimeRange(s.startTime, s.endTime)}
                  <span className="ml-xs">
                    担当 {s.employeeNames.length ? s.employeeNames.join('・') : '未定'}
                  </span>
                </div>

                {s.past ? (
                  s.attendanceStatus === 'absent' ? (
                    <div className="mt-[6px] text-[12px] text-muted">
                      欠席のため授業記録はありません。
                    </div>
                  ) : s.note ? (
                    <>
                      <p className="my-[7px] border-l-2 border-hairline pl-sm text-[13px]
                        leading-relaxed text-body">
                        {s.note}
                      </p>
                      {s.notedByName ? (
                        <div className="text-[12px] text-muted">記録: {s.notedByName}</div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-[6px] text-[12px] text-muted">
                      授業記録はまだ記入されていません。
                    </div>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="px-md py-sm text-[12px] leading-relaxed text-muted">
          左右に払っても月を切り替えられます。<br />
          月謝は<strong className="text-ink">固定月額</strong>です。
          <strong className="text-ink">お休みされても請求額は変わりません。</strong>
        </p>
      </div>
    </Card>
  );
}
