import { useMemo, useState } from 'react';
import {
  Badge, Card, Empty, Loading, ErrorNote, Note, SectionLabel, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import {
  addPreference, addWorkPreference, fetchBusinessSlots, fetchBusinesses, fetchDeadline,
  fetchEmployees, fetchPreferences, fetchStudents, fetchWorkPreferences,
  removePreference, removeWorkPreference,
} from '@/lib/queries';
import {
  currentMonthKey, daysInMonth, formatDayJa, formatTimeRange, parseMonthKey,
  shiftMonth, toISODate, untilLabel, weekdayOf,
} from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import { MonthHeader } from './MonthHeader';

/**
 * 希望提出（保護者は受講希望、講師は勤務希望）。
 *
 * **締め切りの判定は DB に任せる。** 締め切りを過ぎていたり、その月の締め切り行が
 * まだ無ければ RLS が書き込みを弾く。画面でも日付を判定すると、判定が二重になって
 * 必ずどちらかがずれる。ここでは「押せるか」ではなく「なぜ押せなかったか」を出す。
 *
 * 受講回数の上限と「1日1コマ」も DB のトリガーと一意制約が見ている。
 */
export function SubmitPage() {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const isParent = role !== 'employee';
  const [month, setMonth] = useState(shiftMonth(currentMonthKey(), 1));
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [businesses, slots, deadline, students, prefs, employees, work] = await Promise.all([
      fetchBusinesses(),
      fetchBusinessSlots(),
      fetchDeadline(month, isParent ? 'parent' : 'employee'),
      isParent ? fetchStudents() : Promise.resolve([]),
      isParent ? fetchPreferences(month) : Promise.resolve([]),
      isParent ? Promise.resolve([]) : fetchEmployees(),
      isParent ? Promise.resolve([]) : fetchWorkPreferences(month),
    ]);
    return { businesses, slots, deadline, students, prefs, employees, work };
  }, [month, isParent]);

  /** 対象月の開催日 × コマ。business_slots から作る（コードに曜日を書かない） */
  const openings = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    const { year, month: m } = parseMonthKey(month);
    const out: { date: string; weekday: number; businessId: string; slotNo: number; start: string; end: string }[] = [];
    for (let day = 1; day <= daysInMonth(year, m); day++) {
      const date = toISODate(year, m, day);
      const w = weekdayOf(date);
      for (const s of d.slots) {
        if (s.weekday !== w) continue;
        out.push({
          date, weekday: w, businessId: s.businessId, slotNo: s.slotNo,
          start: s.startTime, end: s.endTime,
        });
      }
    }
    return out;
  }, [state.data, month]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
  const me = d.employees.find((e) => e.id === user?.id);
  const closed = !d.deadline || !d.deadline.active
    || new Date(d.deadline.deadlineAt).getTime() < Date.now();

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth}>
        <p className="mt-sm text-center text-[12px] text-muted">
          {!d.deadline ? (
            <span className="text-coral">この月はまだ受付が始まっていません</span>
          ) : !d.deadline.active ? (
            <span className="text-coral">この月は受付を止めています</span>
          ) : closed ? (
            <span className="text-coral">締め切りました（{new Date(d.deadline.deadlineAt).toLocaleString('ja-JP')}）</span>
          ) : (
            <>締め切りまで <strong className="text-ink">{untilLabel(d.deadline.deadlineAt)}</strong></>
          )}
        </p>
      </MonthHeader>

      {closed ? (
        <Note icon="warning">
          {!d.deadline
            ? 'この月の受付はまだ始まっていません。受付が始まるまで提出できません。'
            : '締め切りを過ぎているため、提出・取り消しはできません。変更が必要な場合は教室にご連絡ください。'}
        </Note>
      ) : null}

      {isParent ? (
        d.students.length === 0 ? (
          <Card><Empty title="登録されている生徒がいません。" /></Card>
        ) : (
          d.students.map((s) => {
            const mine = d.prefs.filter((p) => p.studentId === s.id);
            const left = s.sessionsPerMonth - mine.length;
            const list = openings.filter((o) => o.businessId === s.businessId);
            return (
              <div key={s.id} className="mb-lg">
                <SectionLabel>{s.name}</SectionLabel>
                <Card>
                  <div className="flex items-center gap-sm border-b border-hairline px-md py-sm">
                    <span className="min-w-0 flex-1 text-[13px] text-muted">
                      {s.gradeLabel} 月{s.sessionsPerMonth}回
                    </span>
                    <Badge tone={left === 0 ? 'success' : 'warn'}>
                      {left === 0 ? '選択済み' : `あと${left}回`}
                    </Badge>
                  </div>
                  <ul>
                    {list.map((o) => {
                      const hit = mine.find(
                        (p) => p.sessionDate === o.date && p.slotNo === o.slotNo,
                      );
                      // 同じ日に別のコマを選んでいたら、その日はもう選べない
                      const sameDay = mine.find((p) => p.sessionDate === o.date && p.slotNo !== o.slotNo);
                      const key = `${s.id}-${o.date}-${o.slotNo}`;
                      const blocked = closed || Boolean(sameDay) || (!hit && left <= 0);
                      return (
                        <li key={key} className="border-b border-hairline last:border-0">
                          <button
                            type="button"
                            disabled={blocked || busy === key}
                            onClick={() => void run(
                              key,
                              () => hit
                                ? removePreference(hit.id)
                                : addPreference(s.id, month, o.date, o.slotNo),
                              hit ? '取り消しました' : '希望を出しました',
                            )}
                            className={`flex w-full items-center gap-sm px-md py-sm text-left
                              disabled:opacity-45 ${hit ? 'bg-state-confirmed' : ''}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14px] text-ink">{formatDayJa(o.date)}</span>
                              <span className="block text-[12px] text-muted tnum">
                                第{o.slotNo}コマ {formatTimeRange(o.start, o.end)}
                              </span>
                            </span>
                            {hit ? <Badge tone="success">希望済み</Badge> : null}
                            {!hit && sameDay ? <Badge tone="neutral">同じ日に選択済み</Badge> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>
            );
          })
        )
      ) : (
        <div>
          <SectionLabel>勤務できる日</SectionLabel>
          <Card>
            <ul>
              {openings
                .filter((o) => !me || me.businessIds.includes(o.businessId))
                .map((o) => {
                  const hit = d.work.find(
                    (w) => w.sessionDate === o.date && w.slotNo === o.slotNo
                      && w.businessId === o.businessId,
                  );
                  const key = `${o.businessId}-${o.date}-${o.slotNo}`;
                  const biz = bizMap.get(o.businessId);
                  return (
                    <li key={key} className="border-b border-hairline last:border-0">
                      <button
                        type="button"
                        disabled={closed || busy === key || !user}
                        onClick={() => void run(
                          key,
                          () => hit
                            ? removeWorkPreference(hit.id)
                            : addWorkPreference(user!.id, o.businessId, month, o.date, o.slotNo),
                          hit ? '取り消しました' : '勤務希望を出しました',
                        )}
                        className={`flex w-full items-center gap-sm px-md py-sm text-left
                          disabled:opacity-45 ${hit ? 'bg-state-confirmed' : ''}`}
                      >
                        <span
                          aria-hidden
                          className={`h-[9px] w-[9px] rounded-pill ${biz?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] text-ink">{formatDayJa(o.date)}</span>
                          <span className="block text-[12px] text-muted tnum">
                            {biz?.name ?? '—'} 第{o.slotNo}コマ {formatTimeRange(o.start, o.end)}
                          </span>
                        </span>
                        {hit ? <Badge tone="success">希望済み</Badge> : null}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Card>
          {me && me.businessIds.length === 0 ? (
            <Note icon="warning">
              担当できる教室が設定されていません。管理者に設定を依頼してください。
            </Note>
          ) : null}
        </div>
      )}

      <Note>
        {isParent ? (
          <>
            受講回数はコースで決まっていて、<strong className="text-ink">同じ日に2コマは選べません</strong>。
            提出した内容がそのまま確定するわけではなく、教室が調整して確定します。
          </>
        ) : (
          <>
            出した希望がそのままシフトになるわけではありません。教室が調整して確定します。
            <strong className="text-ink">確定した担当コマがそのまま勤務実績</strong>になります。
          </>
        )}
      </Note>
    </div>
  );
}
