import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Loading, ErrorNote, Note, SectionLabel, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  addPreference, fetchBusinessSlots, fetchBusinesses, fetchDeadline, fetchPreferences,
  fetchStudents, removePreference,
} from '@/lib/queries';
import {
  currentMonthKey, formatDayJa, formatMonthJa, formatTimeRange, shiftMonth,
} from '@/lib/date';
import { MonthHeader } from './MonthHeader';
import { KidSwitch } from './KidSwitch';
import { SubmitCounter } from './SubmitCounter';
import { PickRow } from './PickRow';
import { buildOpenings, openingKey } from './openings';
import type { Student } from '@/types/domain';

/**
 * 受講希望の提出（保護者）。
 *
 * **希望は予約ではなく候補。** 通える日をいくつでも出してよく（0件でもよい）、
 * その中からコースの回数ぶんを管理者がスケジュール確定で選ぶ。
 * 以前は「コースの回数ちょうどを選ばないと出せない」だったが、それだと
 * 保護者が通う日まで決めることになり、**管理者に動かせる余地が残らない**
 * （定員が埋まっていても差し替えられない）。同じ日の別コマも候補に出せる。
 *
 * **選択は画面の中だけで持ち、「提出する」で1回だけ書き込む。**
 * 1タップごとに書くと、候補の数だけ通信が走り、途中で切れたときに
 * 「どこまで出したか」が本人にも分からなくなる。
 *
 * 締め切りの判定は DB に任せる。締め切りを過ぎていたり、その月の締め切り行が
 * まだ無ければ RLS が書き込みを弾く。画面でも日付を判定すると判定が二重になり、
 * 必ずどちらかがずれる。ここでは「押せるか」ではなく「なぜ押せなかったか」を出す。
 */
export function ParentSubmit() {
  const { toast } = useToast();
  const [month, setMonth] = useState(shiftMonth(currentMonthKey(), 1));
  const [kidId, setKidId] = useState('');
  /** 触った生徒だけ入る。入っていない生徒は「サーバーのまま」 */
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    const [businesses, slots, deadline, students, prefs] = await Promise.all([
      fetchBusinesses(), fetchBusinessSlots(), fetchDeadline(month, 'parent'),
      fetchStudents(), fetchPreferences(month),
    ]);
    return { businesses, slots, deadline, students, prefs };
  }, [month]);

  // 月を変えたら選択はやり直し。前の月の選択を持ち越すと別の月に書き込む
  useEffect(() => { setDraft({}); }, [month]);

  const openings = useMemo(
    () => buildOpenings(month, state.data?.slots ?? []),
    [month, state.data],
  );

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  if (d.students.length === 0) {
    return (
      <div>
        <MonthHeader month={month} onChange={setMonth} />
        <Card><Empty title="登録されている生徒がいません。" hint="教室にお問い合わせください。" /></Card>
      </div>
    );
  }

  const kid = d.students.find((s) => s.id === kidId) ?? d.students[0]!;
  const closed = !d.deadline || !d.deadline.active
    || new Date(d.deadline.deadlineAt).getTime() < Date.now();

  const serverOf = (s: Student) => d.prefs
    .filter((p) => p.studentId === s.id)
    .map((p) => ({ ...p, key: openingKey({ businessId: s.businessId, date: p.sessionDate, slotNo: p.slotNo }) }));

  const pickedOf = (s: Student) => draft[s.id] ?? serverOf(s).map((p) => p.key);

  const picked = pickedOf(kid);

  const toggle = (key: string) => {
    setDraft((prev) => {
      const cur = prev[kid.id] ?? serverOf(kid).map((p) => p.key);
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [kid.id]: next };
    });
  };

  /** 変更のある生徒だけ。触っただけで内容が同じなら送らない */
  const changes = d.students.map((s) => {
    const server = serverOf(s);
    const cur = new Set(pickedOf(s));
    const serverKeys = new Set(server.map((p) => p.key));
    return {
      student: s,
      remove: server.filter((p) => !cur.has(p.key)),
      add: [...cur].filter((k) => !serverKeys.has(k)),
    };
  }).filter((c) => c.remove.length > 0 || c.add.length > 0);

  const submit = async () => {
    if (changes.length === 0) {
      toast('すでにこの内容で提出済みです。');
      return;
    }
    setBusy(true);
    try {
      /* **消してから足す。** 同じコマの二重登録は一意制約が見ているので、
         入れ替えのときに足す側が先に走ると自分自身とぶつかる。 */
      for (const c of changes) {
        for (const p of c.remove) await removePreference(p.id);
      }
      for (const c of changes) {
        for (const key of c.add) {
          const [, date, slotNo] = key.split('|');
          await addPreference(c.student.id, month, date!, Number(slotNo));
        }
      }
      toast(`${formatMonthJa(month)}の受講希望を提出しました`);
      setDraft({});
      state.reload();
    } catch (e) {
      // 途中で失敗すると一部だけ反映されている。読み直して実際の状態を出す
      toast(toMessage(e));
      setDraft({});
      state.reload();
    } finally {
      setBusy(false);
    }
  };

  const list = openings.filter((o) => o.businessId === kid.businessId);

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      <KidSwitch
        students={d.students}
        businesses={d.businesses}
        selectedId={kid.id}
        onSelect={setKidId}
      />

      {/* 上限は候補の数そのもの。コースの回数は「このうち何コマ決まるか」であって、
          出せる希望の数ではない */}
      <SubmitCounter count={picked.length} max={list.length} deadline={d.deadline} />

      {closed ? (
        <Note icon="warning">
          {!d.deadline
            ? 'この月の受付はまだ始まっていません。受付が始まるまで提出できません。'
            : '締め切りを過ぎているため、提出・変更はできません。変更が必要な場合は教室にご連絡ください。'}
        </Note>
      ) : null}

      <SectionLabel>{formatMonthJa(month)} の候補日</SectionLabel>

      {list.length === 0 ? (
        <Card><Empty title="この月に開催日がありません。" /></Card>
      ) : (
        list.map((o) => {
          const key = openingKey({ businessId: o.businessId, date: o.date, slotNo: o.slotNo });
          return (
            <PickRow
              key={key}
              selected={picked.includes(key)}
              disabled={closed}
              colorKey={d.businesses.find((b) => b.id === o.businessId)?.colorKey ?? 'forest'}
              /* コマ番号は出さない。同じ日に2コマある教室でも、保護者が選ぶときに
                 見ているのは時刻（下の sub）で、番号では何時からか分からない */
              title={formatDayJa(o.date)}
              sub={formatTimeRange(o.startTime, o.endTime)}
              onToggle={() => toggle(key)}
            />
          );
        })
      )}

      {/* **選んだ数では止めない。** 0件でも出せる（「今月は通えない」も伝える内容）。
          止めるのは締め切りだけ */}
      <Button
        variant="primary"
        block
        className="mt-sm"
        disabled={closed || busy}
        onClick={() => void submit()}
      >
        {picked.length === 0
          ? '希望なしで提出する'
          : changes.length > 1
            ? `この内容で提出する（${changes.length}名ぶん）`
            : 'この内容で提出する'}
      </Button>

      <Note>
        通える日を<strong className="text-ink">いくつでも</strong>選べます。
        同じ日の別の時間も選べます。
        このうち<strong className="text-ink">月{kid.sessionsPerMonth}コマ</strong>を教室が決めます
        （{kid.name}さんのコースの回数です）。
        <strong className="text-ink">多めに出していただくほど組みやすくなります。</strong>
        {d.students.length > 1
          ? 'お子さまを切り替えて選んだぶんも、まとめて提出されます。'
          : null}
      </Note>
    </div>
  );
}
