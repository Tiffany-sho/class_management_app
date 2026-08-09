import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Button, Chip, Loading, ErrorNote, MonthNav, Note, Empty, SectionLabel, useToast,
} from '@/components/ui';
import { confirmMonth } from '@/lib/queries';
import { currentMonthKey, shiftMonth, formatDayJa } from '@/lib/date';
import { toMessage } from '@/lib/supabase';
import { SlotCard } from './SlotCard';
import { DayCard } from './DayCard';
import { useScheduleBoard } from './useScheduleBoard';
import { useSlotPick } from './useSlotPick';

/**
 * スケジュール確定。
 *
 * **日のカードを並べ、押した日のコマだけを下に出す。** 月ぶんのコマを全部並べると
 * 縦に数十枚になり、直したい日にたどり着くまでスクロールし続けることになる。
 * カードには担当未定・定員超過の件数を出して、**開かずに「どの日を直すか」が
 * 決まるようにしてある**。
 *
 * 提出された希望をクリックすると仮確定になる。
 * 定員（担当講師数 × 係数）は DB のビューが返すので、画面では計算しない。
 * 定員超過は警告するだけでブロックしない（実運用で必ず例外が出るため）。
 *
 * **触れるのは下書きのコマだけ。確定したコマはここでは動かせない**（→ useSlotPick）。
 * 直すのは「当日の変更」。この画面は「これからの月を作る」場所で、
 * あちらは「もう決まった日を直す」場所。
 */
export function SchedulePage() {
  // 確定するのは翌月ぶんが基本なので、既定を翌月にする
  const [month, setMonth] = useState(shiftMonth(currentMonthKey(), 1));
  const [bizFilter, setBizFilter] = useState<string>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const { state, groups, days, compare } = useScheduleBoard(month, bizFilter);
  const slotPick = useSlotPick(state.reload);
  const locked = busy || slotPick.busy;

  /* 選ぶ日は「直すべき日」を既定にする。先頭の日を出しても、そこが済んでいれば
     結局どこを開くか探すことになる。要対応が無ければ未確定の先頭、それも無ければ先頭。
     いま選んでいる日がまだ一覧にあるなら動かさない（月やフィルタを変えたときだけ選び直す）。 */
  useEffect(() => {
    if (days.length === 0) { setPicked(null); return; }
    if (picked && days.some((x) => x.date === picked)) return;
    const next = days.find((x) => x.noEmployee > 0 || x.overCapacity > 0)
      ?? days.find((x) => x.confirmed < x.total)
      ?? days[0]!;
    setPicked(next.date);
  }, [days, picked]);

  async function onConfirm() {
    setBusy(true);
    try {
      const n = await confirmMonth(month);
      state.reload();
      toast(n === 0
        ? 'この月に未確定のコマはありませんでした'
        : `${n}コマを確定しました。保護者・講師に表示されます`);
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const draftCount = groups.filter((g) => g.status === 'draft').length;
  const attention = days.reduce((a, x) => a + x.noEmployee + x.overCapacity, 0);
  const shown = groups.filter((g) => g.sessionDate === picked);

  return (
    <div>
      <PageHeader
        title="スケジュール確定"
        actions={
          <>
            <Button size="sm" onClick={state.reload} disabled={locked}>希望を再取得</Button>
            <Button size="sm" variant="primary" onClick={onConfirm} disabled={locked || draftCount === 0}>
              この月を確定（{draftCount}コマ）
            </Button>
          </>
        }
      />

      <div className="mb-md flex flex-wrap items-center gap-md">
        <MonthNav value={month} onChange={setMonth} />
        <div className="flex gap-xs">
          <Chip active={bizFilter === 'all'} onClick={() => setBizFilter('all')}>すべて</Chip>
          {d.businesses.map((b) => (
            <Chip key={b.id} active={bizFilter === b.id} onClick={() => setBizFilter(b.id)}>
              <span
                aria-hidden
                className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              {b.name.replace('教室', '')}
            </Chip>
          ))}
        </div>
      </div>

      <Note>
        <strong className="text-ink">日を押すと、その日のコマだけが下に出ます。</strong>
        カードの赤い数字は<strong className="text-ink">先に直すべきコマの数</strong>です。<br />
        <strong className="text-ink">チップを押すと仮確定できます。</strong>
        点線＝希望のみ、塗りつぶし＝仮確定です。<strong className="text-ink">！のついたチップは、
        希望を出していないのに割り当てられている人</strong>です（押せば外せます）。<br />
        <strong className="text-ink">確定したコマはこの画面では変えられません。</strong>
        もう保護者・講師に出ていて、講師なら給与にも効いているためです。
        直すときは<strong className="text-ink">「当日の変更」</strong>から行ってください。<br />
        <strong className="text-ink">定員 = 仮確定した講師の人数 × 事業ごとの係数</strong>。
        講師を足すと定員が伸び、超過警告が消えます。<strong className="text-ink">超過してもブロックはしません。</strong><br />
        ここで仮確定した担当が、そのまま<strong className="text-ink">講師の出勤日・勤務時間</strong>になります（給与計算にも使われます）。
      </Note>

      {days.length === 0 ? (
        <div className="rounded-md border border-hairline bg-canvas shadow-card">
          <Empty
            title="この月にはまだ希望が出ていません"
            hint="締め切りを設定すると保護者・講師が提出できるようになります。締め切り設定はマスタにあります。"
          />
        </div>
      ) : (
        <>
          <SectionLabel>
            開催日 {days.length}日{attention > 0 ? ` ・ 要対応 ${attention}コマ` : ''}
          </SectionLabel>
          {/* 列を増やしすぎない。8列にすると PC でも1枚 120px ほどになり、
              「プログラミング 2」のチップが入らず折り返す。**1枚 160px は残す** */}
          <div className="mb-lg grid grid-cols-2 gap-xs sm:grid-cols-3 app:grid-cols-4 lg:grid-cols-6">
            {days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                businesses={d.businesses}
                selected={day.date === picked}
                onSelect={() => setPicked(day.date)}
              />
            ))}
          </div>

          {picked ? (
            <section>
              <h2 className="mb-xs text-ui-md font-medium text-ink">{formatDayJa(picked)}</h2>
              <div className="grid gap-sm md:grid-cols-2">
                {shown.map((g) => {
                  const biz = d.businesses.find((b) => b.id === g.businessId);
                  return (
                    <SlotCard
                      key={g.key}
                      group={g}
                      business={biz}
                      busy={locked}
                      compare={compare}
                      onToggleStudent={(id) => slotPick.pick('student', g, id)}
                      onToggleEmployee={(id) => slotPick.pick('employee', g, id)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

    </div>
  );
}
