import { Badge, Icon, Loading, ErrorNote, Note, Sheet, Button } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchStudentDetail } from '@/lib/queries';
import { formatDayJa, gradeLabel } from '@/lib/date';
import { yen, ATTENDANCE_LABEL, attendanceTone, FEE_LABEL } from '@/lib/format';

/** 'admin' = すべて / 'employee' = 基本情報・受講と授業記録まで */
export type DetailMode = 'admin' | 'employee';

interface Props {
  studentId: string | null;
  mode: DetailMode;
  onClose: () => void;
}

/**
 * 生徒詳細。**どの画面からでも生徒名を押せば開く。**
 *
 * 講師には月謝を出さない。**出さないのではなく、そもそも読めない**
 * （fees の RLS が1件も返さない）。画面側の分岐は「読めないものを
 * 空欄として出さない」ためのもので、これが権限の実装ではない。
 * 保護者名も同じ理由で講師には出ない（users(parent) が見えない）。
 *
 * 出席率は出さない。月2〜3回なので1回の欠席で数字が大きく振れて実態を表さない
 * （ドメインの決定。管理者向けも同じ）。
 */
export function StudentDetailSheet({ studentId, mode, onClose }: Props) {
  const state = useAsync(
    async () => (studentId ? fetchStudentDetail(studentId) : null),
    [studentId ?? ''],
  );
  const d = state.data;

  const counts = {
    total: d?.history.filter((r) => r.attendanceStatus).length ?? 0,
    present: d?.history.filter((r) => r.attendanceStatus === 'present').length ?? 0,
    late: d?.history.filter((r) => r.attendanceStatus === 'late').length ?? 0,
    absent: d?.history.filter((r) => r.attendanceStatus === 'absent').length ?? 0,
  };
  const last = d?.history.find((r) => r.attendanceStatus);
  const paidTotal = (d?.fees ?? [])
    .filter((f) => f.status === 'paid')
    .reduce((a, f) => a + f.amount, 0);

  return (
    <Sheet
      open={studentId !== null}
      title={d?.name ?? '生徒'}
      subtitle={d
        ? `${d.businessName} ・ ${gradeLabel(d.grade)} ・ ${d.gradeLabel} 月${d.sessionsPerMonth}回`
        : undefined}
      onClose={onClose}
      footer={<Button block onClick={onClose}>閉じる</Button>}
    >
      {state.loading && !d ? <Loading /> : null}
      {state.error ? <ErrorNote message={state.error} onRetry={state.reload} /> : null}

      {d ? (
        <>
          <Section title="基本情報">
            <dl className="grid grid-cols-2 gap-md">
              <KV k="教室" v={d.businessName} />
              <KV
                k="学年"
                v={mode === 'admin'
                  ? `${gradeLabel(d.grade)}（${d.enrollmentYear}年度入学）`
                  : gradeLabel(d.grade)}
              />
              <KV k="コース" v={`${d.gradeLabel} 月${d.sessionsPerMonth}回`} />
              {mode === 'admin' ? <KV k="月額" v={yen(d.monthlyFee)} /> : null}
              {mode === 'admin' ? <KV k="保護者" v={d.parentName ?? '—'} /> : null}
            </dl>
          </Section>

          <Section title="前回の受講">
            {last ? (
              <div className="flex flex-wrap items-center gap-sm rounded-md border border-hairline px-sm py-xs">
                <span className="text-[14px] text-ink">
                  {formatDayJa(last.sessionDate)} 第{last.slotNo}コマ
                </span>
                <span className="flex-1" />
                <Badge tone={attendanceTone(last.attendanceStatus!)}>
                  {ATTENDANCE_LABEL[last.attendanceStatus!]}
                </Badge>
              </div>
            ) : (
              <p className="text-[13px] text-muted">まだ受講記録がありません。</p>
            )}
          </Section>

          {mode === 'admin' ? (
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
                月2〜3回のため出席率は出していません。
              </p>
            </Section>
          ) : null}

          <Section title="受講と授業記録">
            {d.history.length === 0 ? (
              <p className="text-[13px] text-muted">まだ受講記録がありません。</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {d.history.slice(0, 12).map((r) => (
                  <li key={r.scheduleId} className="rounded-md border border-hairline px-sm py-xs">
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
                          : r.attendanceStatus ? '授業記録はまだ記入されていません。' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {mode === 'admin' ? (
            <Section title={`月謝の支払い（支払累計 ${yen(paidTotal)}）`}>
              {d.fees.length === 0 ? (
                <p className="text-[13px] text-muted">まだ請求がありません。</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {d.fees.map((f) => (
                    <li key={f.yearMonth} className="flex flex-wrap items-center gap-xs rounded-md border border-hairline px-sm py-xs">
                      <span className="text-[13px] text-ink tnum">{f.yearMonth}</span>
                      <span className="text-[13px] text-ink tnum">{yen(f.amount)}</span>
                      <span className="flex-1" />
                      {f.paidDate ? (
                        <span className="text-[12px] text-muted tnum">入金 {f.paidDate}</span>
                      ) : null}
                      <Badge tone={f.status === 'paid' ? 'success' : 'danger'}>
                        {FEE_LABEL[f.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : (
            <Note icon="lock">
              月謝や支払い状況は<strong className="text-ink">講師には表示されません</strong>。
              保護者の氏名も同じです。個人情報のため、管理者と保護者だけが見られます。
            </Note>
          )}
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
