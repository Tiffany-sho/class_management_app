import { calendarCells, splitDate, isToday, WEEKDAY_JA } from '@/lib/date';
import { Icon } from '@/components/ui';
import { DayCellChips, type CellMode } from './DayCellChips';
import { MonthDayList } from './MonthDayList';
import type { Business, ScheduleSlot } from '@/types/domain';

export interface DayState {
  /** その日のコマ（事業をまたいで全部） */
  slots: ScheduleSlot[];
  /** 両事業とも確定して初めて「確定した日」。片方でも未確定なら未確定 */
  allConfirmed: boolean;
}

interface Props {
  monthKey: string;
  byDate: Map<string, DayState>;
  businesses: Business[];
  onSelect: (date: string) => void;
  /** 管理者だけ確定/未確定のラベルを出す。保護者・講師には関係のない区別 */
  showStatus?: boolean;
  /** マスの中身。既定は事業ごとのコマ数（管理者向け）。→ DayCellChips */
  cell?: CellMode;
  /**
   * 狭い画面での出し方。
   * `list`（既定）… 升目をやめて日ごとの一覧にする（→ MonthDayList）
   * `none` … 何も出さない。**呼ぶ側が狭い画面で別のものを見せているとき**に使う
   *   （講師の予定は下に「予定 / 終了」の一覧があるので、日ごとの一覧を出すと
   *    同じコマが2回並ぶ）。描かないので DOM にも残らない
   */
  narrow?: 'list' | 'none';
}

/**
 * 月カレンダー。
 *
 * 確定 / 未確定 は背景色だけで区別しない。隣り合う淡い面の色差は
 * ΔE で 2 を切ると人間には見分けられないので、左端の色帯と文字ラベルを併用する。
 *
 * マスの中身は読む人によって変える（`cell`）。管理者は「どの教室が何コマか」だが、
 * 講師にとってはどちらの教室かは自明で、要るのは「誰と組むか・何人来るか」。
 */
export function MonthCalendar({
  monthKey, byDate, businesses, onSelect, showStatus = false, cell = { kind: 'business' },
  narrow = 'list',
}: Props) {
  const cells = calendarCells(monthKey);

  return (
    <>
      {/* 狭い画面は升目をやめて日ごとの一覧にする（→ MonthDayList）。
          土日しか開かないので、7列にすると月〜金の5列が空のまま幅の 5/7 を占め、
          残りが 53px になって数字1つしか置けなくなる。 */}
      {narrow === 'list' ? (
      <div className="sm:hidden">
        <MonthDayList
          dates={cells.filter((c): c is string => Boolean(c))}
          byDate={byDate}
          businesses={businesses}
          onSelect={onSelect}
          showStatus={showStatus}
          cell={cell}
        />
      </div>
      ) : null}

    <div className="hidden overflow-hidden rounded-md border border-hairline bg-canvas shadow-card sm:block">
      <div className="grid grid-cols-7 border-b border-hairline">
        {WEEKDAY_JA.map((w, i) => (
          <div
            key={w}
            className={`px-xs py-[6px] text-left text-ui-xs font-medium
              ${i === 0 ? 'text-coral' : i === 6 ? 'text-info' : 'text-muted'}`}
          >
            {w}
          </div>
        ))}
      </div>

      {[0, 1, 2, 3, 4, 5].map((week) => (
        <div key={week} className="grid grid-cols-7 border-b border-hairline last:border-0">
          {cells.slice(week * 7, week * 7 + 7).map((date, i) => {
            if (!date) {
              return <div key={`${week}-${i}`} className="min-h-[88px] app:min-h-[92px] border-r border-hairline bg-surface-soft last:border-0" />;
            }
            const state = byDate.get(date);
            const has = Boolean(state && state.slots.length > 0);
            const [, , day] = splitDate(date);
            const today = isToday(date);

            const tone = !has
              ? ''
              : state!.allConfirmed
                ? 'bg-state-confirmed shadow-[inset_4px_0_0_theme(colors.forest)]'
                : 'bg-state-pending shadow-[inset_4px_0_0_theme(colors.coral)]';

            return (
              <button
                key={date}
                type="button"
                disabled={!has}
                onClick={() => onSelect(date)}
                className={`flex min-h-[88px] app:min-h-[92px] flex-col gap-[3px] border-r border-hairline p-[6px]
                  text-left last:border-0 ${tone}
                  ${has ? 'cursor-pointer hover:brightness-[.98]' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-[4px]">
                  <span
                    className={`text-ui-sm tnum ${today
                      ? 'grid h-[24px] w-[24px] place-items-center rounded-pill bg-primary text-on-primary'
                      : 'text-muted'}`}
                  >
                    {day}
                  </span>
                  {/* 文字を大きくしたぶん、狭い画面では日付と並べると入らない。
                      **入らないものは出さない**（切り詰めない）。確定／未確定は
                      マスの面の色と左の帯でも分かり、凡例がその意味を書いている */}
                  {showStatus && has ? (
                    <span
                      className={`ml-auto hidden items-center gap-[2px] text-ui-2xs sm:flex
                        ${state!.allConfirmed ? 'text-forest' : 'text-coral'}`}
                    >
                      {state!.allConfirmed ? <Icon name="check" size={11} /> : null}
                      {state!.allConfirmed ? '確定' : '未確定'}
                    </span>
                  ) : null}
                </div>

                <DayCellChips slots={state?.slots ?? []} businesses={businesses} mode={cell} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
    </>
  );
}

/**
 * 凡例。色の意味は必ず書く（色だけでは伝わらない）。
 *
 * `showStatus` は管理者だけ true。保護者・講師には確定したコマしか届かないので、
 * 「未確定」の説明を出すと、存在しない状態を探させることになる。
 */
export function CalendarLegend({ businesses, showStatus = true }: {
  businesses: Business[];
  showStatus?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-md text-ui-xs text-muted">
      {businesses.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-[5px]">
          <i className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`} />
          {b.name}
        </span>
      ))}
      {/* 破線チップも面の色も**升目にしか出てこない**。狭い画面は日ごとの一覧に
          切り替わり、確定/未確定は行に文字で書いてあるので、ここで色の説明をすると
          画面に無いものを探させることになる */}
      {showStatus ? (
        <span className="hidden flex-wrap items-center gap-md sm:flex">
          <span className="inline-flex items-center gap-[5px]">
            <i className="h-[11px] w-[14px] rounded-sm border border-dashed border-border-strong" />
            未確定のコマ
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <i className="h-[11px] w-[14px] rounded-sm bg-state-confirmed shadow-[inset_4px_0_0_theme(colors.forest)]" />
            確定した日
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <i className="h-[11px] w-[14px] rounded-sm bg-state-pending shadow-[inset_4px_0_0_theme(colors.coral)]" />
            未確定を含む日
          </span>
        </span>
      ) : null}
    </div>
  );
}
