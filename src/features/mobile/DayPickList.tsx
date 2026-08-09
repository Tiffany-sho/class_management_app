import { Card, Empty, Icon, SectionLabel } from '@/components/ui';
import { formatDayJa, formatTimeRange, isPast } from '@/lib/date';
import type { BusinessColorKey } from '@/types/domain';

export interface DayPick {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  colorKey: BusinessColorKey;
  /** 時刻のうしろに足す補足。講師の担当なら「生徒3名」、希望なら無し */
  meta?: string;
}

interface Props {
  days: DayPick[];
  /** 「決まった日 3件」「提出した希望 4件」の見出し。呼び方が違うので渡す */
  label: string;
  emptyTitle: string;
  emptyHint?: string;
}

/**
 * 日付のカードを並べる。**もう触れない日**を見せるところで使う。
 *   確定した月 → 決まった日（→ ParentDecidedMonth / EmployeeDecidedMonth）
 *   提出済みの月 → 提出した希望（→ ParentSubmitted / EmployeeSubmitted）
 *
 * どちらも元は候補日を全部並べたままにしていた。チェックが付いたきり全部が
 * 押せない状態で、**いちばん知りたい「結局どうなったのか」がどこにも書いて
 * いない**。候補8件のうち4件を出した月でも、画面には8件が並んで見える。
 *
 * 締め切りの帯も提出ボタンも出さない ―― 押せないものを並べておくと、
 * 「まだ変えられるのでは」と探させることになる。
 *
 * **終わった回も残す。** 「今月は何回来たか」を確かめるのはたいてい月末で、
 * そのとき消えていると数えられない。済んだことは面の色を落として示す。
 */
export function DayPickList({ days, label, emptyTitle, emptyHint }: Props) {
  const sorted = [...days].sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return (
    <>
      <SectionLabel>{label} {sorted.length}件</SectionLabel>

      {sorted.length === 0 ? (
        <Card className="mb-md"><Empty title={emptyTitle} hint={emptyHint} /></Card>
      ) : (
        sorted.map((d) => {
          const done = isPast(d.date);
          const prog = d.colorKey === 'forest';
          return (
            <div
              key={d.key}
              className={`mb-[9px] flex items-center gap-sm rounded-md border px-[14px] py-sm
                ${done
                  ? 'border-hairline bg-canvas'
                  : prog
                    ? 'border-forest bg-prog-tint'
                    : 'border-coral bg-illust-tint'}`}
            >
              <span
                aria-hidden
                className={`grid h-[20px] w-[20px] shrink-0 place-items-center rounded-pill
                  ${done
                    ? 'bg-surface-soft text-muted'
                    : prog ? 'bg-forest text-on-dark' : 'bg-coral text-on-dark'}`}
              >
                <Icon name="check" size={13} />
              </span>

              <span className="min-w-0 flex-1">
                <span className={`block text-ui-md ${done ? 'text-muted' : 'text-ink'}`}>
                  {formatDayJa(d.date)}
                </span>
                <span className="mt-[2px] block text-ui-sm text-muted tnum">
                  {formatTimeRange(d.startTime, d.endTime)}
                  {d.meta ? ` ・ ${d.meta}` : ''}
                </span>
              </span>

              {/* 済んだ回であることは面の色でも分かるが、**色だけには頼らない** */}
              {done ? <span className="shrink-0 text-ui-xs text-muted">終了</span> : null}
            </div>
          );
        })
      )}
    </>
  );
}
