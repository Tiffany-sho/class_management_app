import { Badge, Button, Card, NameLink, Segmented } from '@/components/ui';
import { formatTimeRange } from '@/lib/date';
import type { AttendanceStatus, Business, ScheduleSlot } from '@/types/domain';

const ATTENDANCE: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: '出席' },
  { value: 'late', label: '遅刻' },
  { value: 'absent', label: '欠席' },
];

interface Props {
  slot: ScheduleSlot;
  business: Business | undefined;
  /** その事業を担当できる講師（この日に入っていない人も含む） */
  candidates: { id: string; name: string }[];
  /** 欠席連絡が届いている生徒。届いた連絡と画面の出欠を突き合わせられるようにする */
  reportedStudentIds: Set<string>;
  busy: string | null;
  onToggleEmployee: (employeeId: string, assigned: boolean) => void;
  onMark: (studentId: string, status: AttendanceStatus) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenStaff: (employeeId: string) => void;
}

/**
 * 1コマぶんの当日変更。
 *
 * 講師を外すと**その回は勤務実績から消え、給与も下がる**（確定したコマがそのまま実績）。
 * 足した講師にはその回のぶんが付く。だから「代わりを入れてから外す」ではなく、
 * どちらの操作も1回で完了するようにしてある（片方だけ済んだ状態が残らないように）。
 *
 * **足す側は「代わりに入れる」ではなく「講師を追加」と出す。** 代役としてしか入れられないと
 * 読めると、単に1名増やしたいときに押す場所が無いように見える。
 * 出せるのは**その教室を担当できる講師だけ**（時給が教室ごとに決まるうえ、
 * DB 側も employee_businesses への複合外部キーで縛っている）。全員入っているときは
 * 「増やすには講師ページで担当教室を設定する」と行き先まで書く ―― プログラミング教室は
 * 講師が2名しかいないので、**この状態が普通に起きる**。
 *
 * 生徒は**外さずに欠席にする**。外すと「その日に来る予定だった」ことまで消えて、
 * 保護者のマイページから記録ごと無くなる。月謝は固定月額なので、欠席にしても請求は変わらない。
 */
export function DaySlotCard({
  slot, business, candidates, reportedStudentIds, busy,
  onToggleEmployee, onMark, onOpenStudent, onOpenStaff,
}: Props) {
  const assigned = new Set(slot.employees.map((e) => e.id));
  const spare = candidates.filter((c) => !assigned.has(c.id));

  return (
    <Card className="mb-md">
      <header className="flex flex-wrap items-center gap-xs border-b border-hairline px-md py-sm">
        <span
          aria-hidden
          className={`h-[9px] w-[9px] rounded-pill ${business?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
        />
        <span className="text-[14px] text-ink">{business?.name ?? '—'} 第{slot.slotNo}コマ</span>
        <span className="text-[12px] text-muted tnum">
          {formatTimeRange(slot.startTime, slot.endTime)}
        </span>
        <span className="flex-1" />
        {slot.employees.length === 0 ? (
          <Badge tone="danger">担当なし</Badge>
        ) : slot.isOverCapacity ? (
          <Badge tone="danger">定員超過</Badge>
        ) : null}
        {slot.status === 'confirmed'
          ? <Badge tone="success">確定</Badge>
          : <Badge tone="neutral">未確定</Badge>}
      </header>

      <section className="border-b border-hairline px-md py-sm">
        <div className="mb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
          担当講師（{slot.employees.length}名 ／ 定員 {slot.capacity}名）
        </div>

        {slot.employees.length === 0 ? (
          <p className="mb-xs text-[13px] text-coral">
            担当がいません。このままでは開催できません。
          </p>
        ) : (
          <ul className="mb-xs flex flex-col gap-xs">
            {slot.employees.map((e) => (
              <li key={e.id} className="flex items-center gap-sm rounded-md border border-hairline px-sm py-xs">
                <span className="flex-1 text-[13px]">
                  <NameLink onClick={() => onOpenStaff(e.id)}>{e.name}</NameLink>
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === `emp-${slot.id}-${e.id}`}
                  onClick={() => onToggleEmployee(e.id, true)}
                >
                  欠勤にする
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* 「代わりに入れる」ではなく「追加」。外した人の代役としてしか入れられないと
            読めると、**単に1名増やしたいとき**に押す場所が無いように見える */}
        <div className="mt-sm border-t border-hairline pt-sm">
          <div className="mb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
            講師を追加
          </div>
          {spare.length > 0 ? (
            <>
              <div className="mb-xs flex flex-wrap gap-xs">
                {spare.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    disabled={busy === `emp-${slot.id}-${c.id}`}
                    onClick={() => onToggleEmployee(c.id, false)}
                  >
                    ＋ {c.name}
                  </Button>
                ))}
              </div>
              <p className="text-[12px] text-muted">
                押すとその場でこのコマの担当に入り、この回ぶんの給与が付きます。定員も伸びます。
              </p>
            </>
          ) : (
            <p className="text-[12px] text-muted">
              この教室を担当できる講師{candidates.length}名は、全員このコマに入っています。
              足せる人を増やすには、<strong className="text-ink">「講師」ページで担当教室を設定</strong>してください
              （時給が教室ごとに決まるので、担当教室が未設定の講師はここに出せません）。
            </p>
          )}
        </div>
      </section>

      <section className="px-md py-sm">
        <div className="mb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
          受講生徒（{slot.students.length}名）
        </div>

        {slot.students.length === 0 ? (
          <p className="text-[13px] text-muted">受講生徒がいません。</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {slot.students.map((st) => (
              <li key={st.studentId} className="flex flex-wrap items-center gap-sm">
                <span className="min-w-0 flex-1 text-[13px]">
                  <NameLink onClick={() => onOpenStudent(st.studentId)}>{st.studentName}</NameLink>
                  {reportedStudentIds.has(st.studentId) ? (
                    <span className="ml-xs"><Badge tone="warn">欠席連絡あり</Badge></span>
                  ) : null}
                </span>
                <Segmented
                  value={st.attendanceStatus ?? ''}
                  options={ATTENDANCE}
                  disabled={busy === `stu-${slot.id}-${st.studentId}`}
                  onChange={(v) => onMark(st.studentId, v)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
