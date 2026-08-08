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
 * **選択は画面の中だけで持ち、「提出する」で1回だけ書き込む。**
 * 1タップごとに書くと、候補の数だけ通信が走り、途中で切れたときに
 * 「どこまで出したか」が本人にも分からなくなる。
 *
 * 締め切りの判定は DB に任せる。締め切りを過ぎていたり、その月の締め切り行が
 * まだ無ければ RLS が書き込みを弾く。画面でも日付を判定すると判定が二重になり、
 * 必ずどちらかがずれる。ここでは「押せるか」ではなく「なぜ押せなかったか」を出す。
 *
 * 受講回数の上限と「1日1コマ」も DB のトリガーと一意制約が見ている。
 * 画面側の制限は**先回りして分かるようにするため**のもので、これが最後の砦ではない。
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
  const pickedDays = new Set(picked.map((k) => k.split('|')[1]));

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

  /* 提出できる条件は「変更があるか」ではなく **「選択が揃っているか」**。
     差分で判定すると、上限まで選び終えた（＝出せる状態になった）ときに限って
     ボタンが「変更はありません」になり、押せなくなる。
     触っていない子の元からの不足までは咎めない（その子を直しに来たとは限らない）。 */
  const incomplete = d.students
    .map((s) => ({ student: s, left: s.sessionsPerMonth - pickedOf(s).length }))
    .filter((x) => x.left !== 0)
    .filter((x) => x.student.id === kid.id || draft[x.student.id] !== undefined);

  const submit = async () => {
    if (changes.length === 0) {
      toast('すでにこの内容で提出済みです。');
      return;
    }
    setBusy(true);
    try {
      /* **消してから足す。** 上限チェックは行ごとの after トリガー、
         「1日1コマ」は一意制約なので、上限いっぱいの状態で日を差し替えると
         足す側が先に走った時点で弾かれる。 */
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
  const left = kid.sessionsPerMonth - picked.length;

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      <KidSwitch
        students={d.students}
        businesses={d.businesses}
        selectedId={kid.id}
        onSelect={setKidId}
      />

      <SubmitCounter count={picked.length} max={kid.sessionsPerMonth} deadline={d.deadline} />

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
          const on = picked.includes(key);
          const sameDay = !on && pickedDays.has(o.date);
          const full = !on && left <= 0;
          return (
            <PickRow
              key={key}
              selected={on}
              disabled={closed || sameDay || full}
              colorKey={d.businesses.find((b) => b.id === o.businessId)?.colorKey ?? 'forest'}
              /* コマ番号は出さない。同じ日に2コマある教室でも、保護者が選ぶときに
                 見ているのは時刻（下の sub）で、番号では何時からか分からない */
              title={formatDayJa(o.date)}
              sub={sameDay
                ? 'この日は選択済み（1日1コマまで）'
                : full
                  ? `上限（月${kid.sessionsPerMonth}コマ）に達しています`
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
        disabled={closed || busy || incomplete.length > 0}
        onClick={() => void submit()}
      >
        {incomplete.length === 0
          ? changes.length > 1
            ? `この内容で提出する（${changes.length}名ぶん）`
            : 'この内容で提出する'
          : incomplete[0]!.student.id === kid.id
            ? incomplete[0]!.left > 0
              ? `あと${incomplete[0]!.left}コマ選んでください`
              : `${-incomplete[0]!.left}コマ多く選ばれています`
            : `${incomplete[0]!.student.name}さんの選択が揃っていません`}
      </Button>

      {incomplete.length > 0 && incomplete[0]!.student.id !== kid.id ? (
        <p className="mt-xs text-center text-[12px] text-coral">
          お子さまを切り替えて、{incomplete[0]!.student.name}さんの選択を揃えてください。
        </p>
      ) : null}

      <Note>
        受講回数はコースで決まっていて、<strong className="text-ink">同じ日に2コマは選べません</strong>。
        <strong className="text-ink">コースの回数ぶんを選び終えてから提出してください。</strong>
        提出した内容がそのまま確定するわけではなく、教室が調整して確定します。
        {d.students.length > 1
          ? 'お子さまを切り替えて選んだぶんも、まとめて提出されます。'
          : null}
      </Note>
    </div>
  );
}
