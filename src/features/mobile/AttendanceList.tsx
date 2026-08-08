import { Badge, Button, NameLink, Segmented } from '@/components/ui';
import type { AttendanceStatus, ScheduleSlot } from '@/types/domain';

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: '出席' },
  { value: 'late', label: '遅刻' },
  { value: 'absent', label: '欠席' },
];

interface Props {
  slot: ScheduleSlot;
  busy: string | null;
  onMark: (studentId: string, status: AttendanceStatus) => void;
  onOpenNote: (studentId: string) => void;
  onOpenStudent: (studentId: string) => void;
}

/**
 * そのコマの出席リスト。
 *
 * 名前・出欠・記録を**1行に横並び**にする（モックの「出席」パネル）。
 * 生徒ごとに縦へ積むと、10名で画面が埋まって出欠を付け終えるまでスクロールし続ける。
 *
 * 授業記録は行に直接書かせず、押して開く。所見は他の生徒の画面を見ながら書くもの
 * ではないうえ、入力欄が並ぶと出欠のボタンが押しにくくなる。
 */
export function AttendanceList({ slot, busy, onMark, onOpenNote, onOpenStudent }: Props) {
  if (slot.students.length === 0) {
    return <p className="text-[13px] text-muted">受講生徒はいません。</p>;
  }

  return (
    <ul className="flex flex-col gap-sm">
      {slot.students.map((st) => {
        const key = `${slot.id}-${st.studentId}`;
        return (
          <li key={st.studentId} className="flex flex-wrap items-center gap-xs">
            <span className="min-w-0 flex-1 text-[14px]">
              <NameLink onClick={() => onOpenStudent(st.studentId)}>{st.studentName}</NameLink>
            </span>
            <Segmented
              value={st.attendanceStatus ?? ''}
              options={OPTIONS}
              disabled={busy === key}
              onChange={(v) => onMark(st.studentId, v)}
            />
            {st.attendanceStatus === 'absent' ? (
              <Badge tone="neutral">記録なし</Badge>
            ) : (
              <Button
                size="sm"
                disabled={busy === key}
                onClick={() => onOpenNote(st.studentId)}
              >
                {st.note ? '記録済' : '記録'}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
