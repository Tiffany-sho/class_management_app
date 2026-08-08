import { Badge, Card, Empty, Icon } from '@/components/ui';
import { useSwipeMonth } from '@/hooks/useSwipeMonth';
import { formatDayJa, formatMonthJa, formatTimeRange, shiftMonth } from '@/lib/date';
import { ATTENDANCE_LABEL, attendanceTone } from '@/lib/format';
import type { AttendanceStatus, BusinessColorKey } from '@/types/domain';

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
}

/**
 * 受講状況（保護者ホームの中心）。
 *
 * **出欠と授業記録を同じ行に出す。** 別のセクションに分けると、
 * 「どの回の記録か」を保護者が突き合わせることになり、食い違っても気づけない。
 *
 * **回数の集計は出さない。** 出席率は月2〜3回しか通わないので1回休むと 67% になり
 * 実態より悪く見えるし、「済んだ n件 / これから n件」も下に1件ずつ並んでいるものを
 * 数え直しただけで、数えて分かることが増えない。
 *
 * **コマ番号（第〇コマ）も出さない。** 保護者にとっては「何時からか」が要る情報で、
 * 教室の内部の並び番号は意味を持たない。
 */
export function KidMonthPanel({ studentName, month, onMonth, sessions }: Props) {
  const ref = useSwipeMonth<HTMLDivElement>((d) => onMonth(shiftMonth(month, d)));

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

        {/* 月謝の話は上の月謝カードに置いた。ここに書くと同じことが2か所に出る */}
        <p className="px-md py-sm text-[12px] leading-relaxed text-muted">
          左右に払っても月を切り替えられます。
        </p>
      </div>
    </Card>
  );
}
