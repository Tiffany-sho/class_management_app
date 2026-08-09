import { Card, Empty, Icon, SectionLabel } from '@/components/ui';
import { formatDayJa, formatTimeRange, isPast } from '@/lib/date';
import type { BusinessColorKey } from '@/types/domain';

export interface DecidedDay {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  colorKey: BusinessColorKey;
  /** 時刻のうしろに足す補足。講師は「生徒3名」、保護者は無し */
  meta?: string;
}

interface Props {
  days: DecidedDay[];
  /** 「決まった日 3件」の見出し。ロールで呼び方が違うので渡す */
  label: string;
  emptyTitle: string;
  emptyHint?: string;
}

/**
 * 確定した月に、**決まった日だけ**を並べる。
 *
 * 希望提出の画面は、確定した月でも候補日を全部並べたままだった。出した希望に
 * チェックが付いたきり全部が押せない状態で、**いちばん知りたい「結局どの日に
 * 決まったのか」がどこにも書いていない**。候補6件のうち2件が決まった月でも、
 * 画面には6件にチェックが付いて見える。
 *
 * 確定した月は候補を出す意味がもう無いので、決まった日のカードだけに差し替える。
 * 締め切りの帯も提出ボタンも出さない ―― 押せないものを並べておくと、
 * 「まだ変えられるのでは」と探させることになる。
 *
 * **終わった回も残す。** 「今月は何回来たか」を確かめるのはたいてい月末で、
 * そのとき消えていると数えられない。済んだことは面の色を落として示す。
 */
export function DecidedDays({ days, label, emptyTitle, emptyHint }: Props) {
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
