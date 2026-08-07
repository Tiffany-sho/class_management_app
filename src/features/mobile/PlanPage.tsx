import { useMemo, useState } from 'react';
import {
  Button, Card, Empty, Field, Loading, ErrorNote, Note, Sheet, TextArea, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { fetchBusinesses, fetchScheduleMonth, reportAbsence } from '@/lib/queries';
import { currentMonthKey, isPast } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import { MonthHeader } from './MonthHeader';
import { LessonItem } from './LessonItem';
import type { ScheduleSlot, ScheduleStudent } from '@/types/domain';

/**
 * 予定。確定したコマだけが並ぶ（未確定は DB 側で見えない）。
 * 保護者はここから欠席を連絡できる。
 */
export function PlanPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isParent = role !== 'employee';
  const [month, setMonth] = useState(currentMonthKey());
  const [target, setTarget] = useState<{ scheduleId: string; studentId: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    const [businesses, slots] = await Promise.all([fetchBusinesses(), fetchScheduleMonth(month)]);
    return { businesses, slots };
  }, [month]);

  const rows = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    const bizMap = new Map(d.businesses.map((b) => [b.id, b]));
    /* 生徒がいないコマも出す（講師は担当だけ、保護者は自分の子だけが RLS で返る）。
       型を揃えないと flatMap の戻りが2種類の配列の合併になる。 */
    type Pair = { slot: ScheduleSlot; student: ScheduleStudent | null };
    return d.slots
      .flatMap<Pair>((s) => (
        s.students.length
          ? s.students.map((st) => ({ slot: s, student: st }))
          : [{ slot: s, student: null }]
      ))
      .map(({ slot, student }) => ({
        key: `${slot.id}-${student?.studentId ?? 'none'}`,
        slot, student, biz: bizMap.get(slot.businessId), past: isPast(slot.sessionDate),
      }))
      .sort((a, b) =>
        a.slot.sessionDate.localeCompare(b.slot.sessionDate) || a.slot.slotNo - b.slot.slotNo);
  }, [state.data]);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await reportAbsence(target.studentId, target.scheduleId, reason);
      toast('欠席を連絡しました。教室が確認します。');
      setTarget(null);
      setReason('');
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  return (
    <div>
      <MonthHeader month={month} onChange={setMonth} />

      <Card className="mb-md">
        {rows.length === 0 ? (
          <Empty
            title="確定した予定はありません。"
            hint="教室がスケジュールを確定すると、ここに出ます。"
          />
        ) : (
          <ul>
            {rows.map((r) => (
              <LessonItem
                key={r.key}
                sessionDate={r.slot.sessionDate}
                slotNo={r.slot.slotNo}
                startTime={r.slot.startTime}
                endTime={r.slot.endTime}
                businessName={r.biz?.name ?? '—'}
                colorKey={r.biz?.colorKey ?? 'forest'}
                past={r.past}
                attendanceStatus={r.student?.attendanceStatus}
                note={r.student?.note}
                notedByName={r.student?.notedByName}
                extra={
                  <div className="text-[12px] text-ink">
                    {r.student ? r.student.studentName : null}
                    {r.slot.employees.length ? (
                      <span className="text-muted">
                        {r.student ? '・' : ''}担当 {r.slot.employees.map((e) => e.name).join('、')}
                      </span>
                    ) : null}
                  </div>
                }
                action={
                  isParent && !r.past && r.student ? (
                    <Button
                      size="sm"
                      onClick={() => setTarget({
                        scheduleId: r.slot.id,
                        studentId: r.student!.studentId,
                        name: r.student!.studentName,
                      })}
                    >
                      欠席の連絡
                    </Button>
                  ) : null
                }
              />
            ))}
          </ul>
        )}
      </Card>

      <Note>
        ここに出るのは<strong className="text-ink">確定した予定だけ</strong>です。
        調整中のものは表示されません。
      </Note>

      <Sheet
        open={Boolean(target)}
        onClose={() => { setTarget(null); setReason(''); }}
        title="欠席の連絡"
        subtitle={target?.name}
        footer={
          <div className="flex gap-sm">
            <Button block onClick={() => { setTarget(null); setReason(''); }}>やめる</Button>
            <Button variant="primary" block disabled={busy} onClick={() => void submit()}>
              連絡する
            </Button>
          </div>
        }
      >
        <Field label="理由" hint="空欄でも構いません。教室が確認します。">
          <TextArea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例）発熱のためお休みします"
          />
        </Field>
        <p className="text-[12px] leading-relaxed text-muted">
          月謝は<strong className="text-ink">固定月額</strong>のため、お休みされても請求額は変わりません。
          振替の可否は教室にご確認ください。
        </p>
      </Sheet>
    </div>
  );
}
