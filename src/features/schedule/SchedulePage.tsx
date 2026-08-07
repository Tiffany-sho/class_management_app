import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Button, Chip, Loading, ErrorNote, MonthNav, Note, Empty, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchBusinesses, fetchScheduleMonth, fetchPreferences, fetchWorkPreferences,
  fetchEmployees, fetchStudents, ensureSchedule, toggleScheduleStudent,
  toggleScheduleEmployee, confirmMonth,
} from '@/lib/queries';
import { currentMonthKey, shiftMonth, formatDayJa } from '@/lib/date';
import { toMessage } from '@/lib/supabase';
import { SlotCard } from './SlotCard';

/**
 * スケジュール確定。
 *
 * 提出された希望をクリックすると仮確定になる。
 * 定員（担当講師数 × 係数）は DB のビューが返すので、画面では計算しない。
 * 定員超過は警告するだけでブロックしない（実運用で必ず例外が出るため）。
 */
export function SchedulePage() {
  // 確定するのは翌月ぶんが基本なので、既定を翌月にする
  const [month, setMonth] = useState(shiftMonth(currentMonthKey(), 1));
  const [bizFilter, setBizFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const state = useAsync(
    async () => {
      const [businesses, slots, prefs, workPrefs, employees, students] = await Promise.all([
        fetchBusinesses(),
        fetchScheduleMonth(month),
        fetchPreferences(month),
        fetchWorkPreferences(month),
        fetchEmployees(),
        fetchStudents(),
      ]);
      return { businesses, slots, prefs, workPrefs, employees, students };
    },
    [month],
  );

  /** 希望と確定を「日付 × コマ × 事業」で束ねる */
  const groups = useMemo(() => {
    const d = state.data;
    if (!d) return [];

    const map = new Map<string, {
      key: string; businessId: string; sessionDate: string; slotNo: number;
      scheduleId: string | null; status: 'draft' | 'confirmed';
      wantStudents: { id: string; name: string }[];
      wantEmployees: { id: string; name: string }[];
      pickedStudents: string[];
      pickedEmployees: string[];
      capacity: number; isOverCapacity: boolean;
    }>();

    const keyOf = (b: string, date: string, no: number) => `${b}|${date}|${no}`;

    for (const p of d.prefs) {
      const k = keyOf(p.businessId, p.sessionDate, p.slotNo);
      const g = map.get(k) ?? blank(k, p.businessId, p.sessionDate, p.slotNo);
      g.wantStudents.push({ id: p.studentId, name: p.studentName });
      map.set(k, g);
    }
    for (const w of d.workPrefs) {
      const k = keyOf(w.businessId, w.sessionDate, w.slotNo);
      const g = map.get(k) ?? blank(k, w.businessId, w.sessionDate, w.slotNo);
      g.wantEmployees.push({ id: w.employeeId, name: w.employeeName ?? '—' });
      map.set(k, g);
    }
    for (const s of d.slots) {
      const k = keyOf(s.businessId, s.sessionDate, s.slotNo);
      const g = map.get(k) ?? blank(k, s.businessId, s.sessionDate, s.slotNo);
      g.scheduleId = s.id;
      g.status = s.status;
      g.pickedStudents = s.students.map((x) => x.studentId);
      g.pickedEmployees = s.employees.map((x) => x.id);
      g.capacity = s.capacity;
      g.isOverCapacity = s.isOverCapacity;
      // 確定済みの人も候補として見えるようにする（外す操作ができなくなるため）
      for (const st of s.students) {
        if (!g.wantStudents.some((x) => x.id === st.studentId)) {
          g.wantStudents.push({ id: st.studentId, name: st.studentName });
        }
      }
      for (const e of s.employees) {
        if (!g.wantEmployees.some((x) => x.id === e.id)) {
          g.wantEmployees.push({ id: e.id, name: e.name });
        }
      }
      map.set(k, g);
    }

    return [...map.values()]
      .filter((g) => bizFilter === 'all' || g.businessId === bizFilter)
      .sort((a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) || a.slotNo - b.slotNo
        || a.businessId.localeCompare(b.businessId));
  }, [state.data, bizFilter]);

  const byDate = useMemo(() => {
    const m = new Map<string, typeof groups>();
    for (const g of groups) {
      const list = m.get(g.sessionDate) ?? [];
      list.push(g);
      m.set(g.sessionDate, list);
    }
    return [...m.entries()];
  }, [groups]);

  async function togglePick(
    kind: 'student' | 'employee',
    g: (typeof groups)[number],
    id: string,
  ) {
    setBusy(true);
    try {
      const scheduleId = g.scheduleId
        ?? (await ensureSchedule(g.businessId, g.sessionDate, g.slotNo));
      const picked = kind === 'student'
        ? g.pickedStudents.includes(id)
        : g.pickedEmployees.includes(id);

      if (kind === 'student') {
        await toggleScheduleStudent(scheduleId, g.businessId, id, picked);
      } else {
        await toggleScheduleEmployee(scheduleId, g.businessId, id, picked);
      }
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div>
      <PageHeader
        title="スケジュール確定"
        actions={
          <>
            <Button size="sm" onClick={state.reload} disabled={busy}>希望を再取得</Button>
            <Button size="sm" variant="primary" onClick={onConfirm} disabled={busy || draftCount === 0}>
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
        <strong className="text-ink">提出された希望をクリックすると仮確定できます。</strong>
        点線＝希望のみ、塗りつぶし＝仮確定です。<br />
        <strong className="text-ink">定員 = 仮確定した講師の人数 × 事業ごとの係数</strong>。
        講師を足すと定員が伸び、超過警告が消えます。<strong className="text-ink">超過してもブロックはしません。</strong><br />
        ここで仮確定した担当が、そのまま<strong className="text-ink">講師の出勤日・勤務時間</strong>になります（給与計算にも使われます）。
      </Note>

      {byDate.length === 0 ? (
        <div className="rounded-md border border-hairline bg-canvas shadow-card">
          <Empty
            title="この月にはまだ希望が出ていません"
            hint="締め切りを設定すると保護者・講師が提出できるようになります。締め切り設定はマスタにあります。"
          />
        </div>
      ) : (
        byDate.map(([date, list]) => (
          <section key={date} className="mb-lg">
            <h2 className="mb-xs text-[14px] font-medium text-ink">{formatDayJa(date)}</h2>
            <div className="grid gap-sm md:grid-cols-2">
              {list.map((g) => (
                <SlotCard
                  key={g.key}
                  group={g}
                  business={d.businesses.find((b) => b.id === g.businessId)}
                  busy={busy}
                  onToggleStudent={(id) => void togglePick('student', g, id)}
                  onToggleEmployee={(id) => void togglePick('employee', g, id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function blank(key: string, businessId: string, sessionDate: string, slotNo: number) {
  return {
    key, businessId, sessionDate, slotNo,
    scheduleId: null as string | null,
    status: 'draft' as const,
    wantStudents: [] as { id: string; name: string }[],
    wantEmployees: [] as { id: string; name: string }[],
    pickedStudents: [] as string[],
    pickedEmployees: [] as string[],
    capacity: 0,
    isOverCapacity: false,
  };
}
