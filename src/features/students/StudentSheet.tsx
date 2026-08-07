import { Badge, Button, Icon, Sheet, Loading, ErrorNote } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { formatDayJa, gradeLabel } from '@/lib/date';
import { yen, ATTENDANCE_LABEL, attendanceTone, FEE_LABEL } from '@/lib/format';
import type { Student, AttendanceStatus } from '@/types/domain';
import type { StudentFee } from '@/lib/queries';

interface Props {
  student: (Student & { businessName: string; fee?: StudentFee }) | null;
  month: string;
  onClose: () => void;
}

interface HistoryRow {
  sessionDate: string;
  slotNo: number;
  attendanceStatus: AttendanceStatus | null;
  note: string | null;
  notedByName: string | null;
}

/**
 * 生徒詳細（管理者）。
 * 出席率は出さず、回数だけ出す。
 * 授業記録は出欠と同じ行に出す（別リストにすると突き合わせることになる）。
 */
export function StudentSheet({ student, month, onClose }: Props) {
  const state = useAsync(async () => {
    if (!student) return null;

    const [history, fees] = await Promise.all([
      supabase
        .from('schedule_students')
        .select(`
          attendance_status, note,
          schedules:schedule_id ( session_date, slot_no, status ),
          noted_by_user:noted_by ( name )
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('fees')
        .select('year_month, amount, status, paid_date, note')
        .eq('student_id', student.id)
        .order('year_month', { ascending: false }),
    ]);

    if (history.error) throw history.error;
    if (fees.error) throw fees.error;

    const rows: HistoryRow[] = (history.data ?? [])
      .map((r) => {
        const sc = r.schedules as unknown as { session_date: string; slot_no: number } | null;
        const nb = r.noted_by_user as unknown as { name: string } | null;
        return {
          sessionDate: sc?.session_date ?? '',
          slotNo: sc?.slot_no ?? 0,
          attendanceStatus: r.attendance_status as AttendanceStatus | null,
          note: r.note,
          notedByName: nb?.name ?? null,
        };
      })
      .filter((r) => r.sessionDate)
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

    return { rows, fees: fees.data ?? [] };
  }, [student?.id ?? '']);

  if (!student) return null;

  const counts = {
    total: state.data?.rows.filter((r) => r.attendanceStatus).length ?? 0,
    present: state.data?.rows.filter((r) => r.attendanceStatus === 'present').length ?? 0,
    late: state.data?.rows.filter((r) => r.attendanceStatus === 'late').length ?? 0,
    absent: state.data?.rows.filter((r) => r.attendanceStatus === 'absent').length ?? 0,
  };

  const paidTotal = (state.data?.fees ?? [])
    .filter((f) => f.status === 'paid')
    .reduce((a, f) => a + f.amount, 0);

  return (
    <Sheet
      open
      title={student.name}
      subtitle={
        <>
          {student.businessName} ・ {gradeLabel(student.grade)} ・ {student.gradeLabel} 月
          {student.sessionsPerMonth}回
        </>
      }
      onClose={onClose}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>閉じる</Button>
          <Button className="flex-1" variant="primary" disabled>編集</Button>
        </>
      }
    >
      <Section title="基本情報">
        <dl className="grid grid-cols-2 gap-md">
          <KV k="教室" v={student.businessName} />
          <KV k="学年" v={`${gradeLabel(student.grade)}（${student.enrollmentYear}年度入学）`} />
          <KV k="コース" v={`${student.gradeLabel} 月${student.sessionsPerMonth}回`} />
          <KV k="月額" v={yen(student.monthlyFee)} />
          <KV k="保護者" v={student.parentName ?? '—'} />
          <KV
            k={`${month} の月謝`}
            v={
              student.fee ? (
                <Badge tone={student.fee.status === 'paid' ? 'success' : 'danger'}>
                  {FEE_LABEL[student.fee.status]}
                </Badge>
              ) : (
                <Badge tone="neutral">請求前</Badge>
              )
            }
          />
        </dl>
      </Section>

      {state.loading ? <Loading /> : null}
      {state.error ? <ErrorNote message={state.error} onRetry={state.reload} /> : null}

      {state.data ? (
        <>
          <Section title="出席状況">
            <div className="grid grid-cols-4 gap-xs text-center">
              {([['受講', counts.total], ['出席', counts.present],
                 ['遅刻', counts.late], ['欠席', counts.absent]] as const).map(([k, v]) => (
                <div key={k} className="rounded-md border border-hairline px-xs py-sm">
                  <div className="text-[12px] text-muted">{k}</div>
                  <div className="text-title-sm text-ink tnum">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-sm text-[12px] leading-relaxed text-muted">
              月謝は固定月額です。<strong className="text-ink">欠席が多くても請求額は変わりません。</strong>
              月2〜3回のため出席率は出していません（1回の欠席で数字が大きく振れて実態を表さないため）。
            </p>
          </Section>

          <Section title="受講と授業記録">
            {state.data.rows.length === 0 ? (
              <p className="text-[13px] text-muted">まだ受講記録がありません。</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {state.data.rows.slice(0, 12).map((r) => (
                  <li key={`${r.sessionDate}-${r.slotNo}`} className="rounded-md border border-hairline px-sm py-xs">
                    <div className="flex items-center gap-xs">
                      <span className="flex-1 text-[13px] text-ink">
                        {formatDayJa(r.sessionDate)} 第{r.slotNo}コマ
                      </span>
                      {r.attendanceStatus ? (
                        <Badge tone={attendanceTone(r.attendanceStatus)}>
                          {ATTENDANCE_LABEL[r.attendanceStatus]}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">予定</Badge>
                      )}
                    </div>
                    <div className="mt-[5px] text-[12px] leading-relaxed text-muted">
                      {r.attendanceStatus === 'absent'
                        ? '欠席のため授業記録はありません。'
                        : r.note
                          ? (
                            <span className="flex items-start gap-[5px]">
                              <Icon name="note" size={14} className="mt-[2px]" />
                              <span>
                                {r.note}
                                {r.notedByName ? `（記録: ${r.notedByName}）` : ''}
                              </span>
                            </span>
                          )
                          : r.attendanceStatus
                            ? '授業記録はまだ記入されていません。'
                            : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`月謝の支払い（支払累計 ${yen(paidTotal)}）`}>
            {state.data.fees.length === 0 ? (
              <p className="text-[13px] text-muted">まだ請求がありません。</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {state.data.fees.map((f) => (
                  <li key={f.year_month} className="flex flex-wrap items-center gap-xs rounded-md border border-hairline px-sm py-xs">
                    <span className="text-[13px] text-ink tnum">{f.year_month}</span>
                    <span className="text-[13px] text-ink tnum">{yen(f.amount)}</span>
                    <span className="flex-1" />
                    {f.paid_date ? (
                      <span className="text-[12px] text-muted tnum">入金 {f.paid_date}</span>
                    ) : null}
                    <Badge tone={f.status === 'paid' ? 'success' : 'danger'}>
                      {FEE_LABEL[f.status as 'paid' | 'unpaid']}
                    </Badge>
                    {f.note ? (
                      <span className="w-full text-[12px] text-muted">{f.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : null}
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-lg">
      <h4 className="mb-xs border-b border-hairline pb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="mt-[3px] text-[14px] text-ink">{v}</dd>
    </div>
  );
}
