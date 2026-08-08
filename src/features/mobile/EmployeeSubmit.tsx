import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Loading, ErrorNote, Note, SectionLabel, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  addWorkPreference, fetchBusinessSlots, fetchBusinesses, fetchDeadline, fetchEmployees,
  fetchWorkPreferences, removeWorkPreference,
} from '@/lib/queries';
import {
  currentMonthKey, formatDayJa, formatMonthJa, formatTimeRange, shiftMonth,
} from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import { multiBusiness } from '@/lib/format';
import { MonthHeader } from './MonthHeader';
import { SubmitCounter } from './SubmitCounter';
import { PickRow } from './PickRow';
import { buildOpenings, openingKey } from './openings';

/**
 * 勤務希望の提出（講師）。
 *
 * **選択は画面の中だけで持ち、「提出する」で1回だけ書き込む。**
 * 講師は月に20コマ近く選ぶので、1タップごとに書くとその数だけ通信が走る。
 *
 * 出せるのは担当できる事業の開催コマだけ。これは複合外部キーで DB 側も担保している。
 * 日曜は2教室が並行開催されるので、同じ日・同じコマ番号でも事業が違えば別の行になる。
 */
export function EmployeeSubmit() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [month, setMonth] = useState(shiftMonth(currentMonthKey(), 1));
  /** null = まだ触っていない（サーバーのまま） */
  const [draft, setDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    const [businesses, slots, deadline, employees, work] = await Promise.all([
      fetchBusinesses(), fetchBusinessSlots(), fetchDeadline(month, 'employee'),
      fetchEmployees(), fetchWorkPreferences(month),
    ]);
    return { businesses, slots, deadline, employees, work };
  }, [month]);

  // 月を変えたら選択はやり直し。持ち越すと別の月に書き込む
  useEffect(() => { setDraft(null); }, [month]);

  const openings = useMemo(
    () => buildOpenings(month, state.data?.slots ?? []),
    [month, state.data],
  );

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const me = d.employees.find((e) => e.id === user?.id);
  const mine = d.work
    .filter((w) => w.employeeId === user?.id)
    .map((w) => ({
      ...w,
      key: openingKey({ businessId: w.businessId, date: w.sessionDate, slotNo: w.slotNo }),
    }));

  const picked = draft ?? mine.map((w) => w.key);
  const closed = !d.deadline || !d.deadline.active
    || new Date(d.deadline.deadlineAt).getTime() < Date.now();

  const toggle = (key: string) => {
    setDraft((prev) => {
      const cur = prev ?? mine.map((w) => w.key);
      return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    });
  };

  const cur = new Set(picked);
  const serverKeys = new Set(mine.map((w) => w.key));
  const remove = mine.filter((w) => !cur.has(w.key));
  const add = [...cur].filter((k) => !serverKeys.has(k));
  const dirty = remove.length > 0 || add.length > 0;

  const submit = async () => {
    if (!user) return;
    /* 出す内容が今のままでも、ボタンは押せるままにしておく（保護者側と同じ）。
       「変更はありません」で押せなくすると、選び終えた人に不具合と映る。 */
    if (!dirty) {
      toast('すでにこの内容で提出済みです。');
      return;
    }
    setBusy(true);
    try {
      // 消してから足す（一意制約に自分自身がぶつからないようにする）
      for (const w of remove) await removeWorkPreference(w.id);
      for (const key of add) {
        const [businessId, date, slotNo] = key.split('|');
        await addWorkPreference(user.id, businessId!, month, date!, Number(slotNo));
      }
      toast(`${formatMonthJa(month)}の勤務希望を提出しました`);
      setDraft(null);
      state.reload();
    } catch (e) {
      // 途中で失敗すると一部だけ反映されている。読み直して実際の状態を出す
      toast(toMessage(e));
      setDraft(null);
      state.reload();
    } finally {
      setBusy(false);
    }
  };

  const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
  const list = openings.filter((o) => !me || me.businessIds.includes(o.businessId));
  /* 掛け持ちの人にだけ教室を出す。1教室しか担当しない人には、全行に同じ名前が並ぶだけ */
  const showBusiness = multiBusiness(list.map((o) => o.businessId));

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      <SubmitCounter count={picked.length} deadline={d.deadline} />

      {closed ? (
        <Note icon="warning">
          {!d.deadline
            ? 'この月の受付はまだ始まっていません。受付が始まるまで提出できません。'
            : '締め切りを過ぎているため、提出・変更はできません。変更が必要な場合は管理者にご連絡ください。'}
        </Note>
      ) : null}

      {me && me.businessIds.length === 0 ? (
        <Note icon="warning">
          担当できる教室が設定されていません。管理者に設定を依頼してください。
        </Note>
      ) : null}

      <SectionLabel>{formatMonthJa(month)} 勤務できるコマ</SectionLabel>

      {list.length === 0 ? (
        <Card><Empty title="この月に担当できる開催コマがありません。" /></Card>
      ) : (
        list.map((o) => {
          const key = openingKey({ businessId: o.businessId, date: o.date, slotNo: o.slotNo });
          const biz = bizMap.get(o.businessId);
          return (
            <PickRow
              key={key}
              selected={picked.includes(key)}
              disabled={closed}
              showDot={showBusiness}
              colorKey={biz?.colorKey ?? 'forest'}
              title={`${formatDayJa(o.date)} 第${o.slotNo}コマ`}
              sub={showBusiness
                ? `${biz?.name ?? '—'} ${formatTimeRange(o.startTime, o.endTime)}`
                : formatTimeRange(o.startTime, o.endTime)}
              onToggle={() => toggle(key)}
            />
          );
        })
      )}

      <Button
        variant="primary"
        block
        className="mt-sm"
        disabled={closed || busy || picked.length === 0}
        onClick={() => void submit()}
      >
        {picked.length === 0 ? '勤務できるコマを選んでください' : 'この内容で提出する'}
      </Button>

      <Note>
        {showBusiness ? (
          <>
            <strong className="text-ink">日曜は2教室が並行開催</strong>されるため、
            同じ時間帯でも教室ごとに分かれています。
          </>
        ) : null}
        出した希望がそのままシフトになるわけではなく、教室が調整して確定します。
        <strong className="text-ink">確定した担当コマがそのまま勤務実績</strong>になります。
      </Note>
    </div>
  );
}
