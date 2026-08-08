import { useEffect, useState } from 'react';
import { Button, Sheet, TextArea } from '@/components/ui';
import { formatDayJa } from '@/lib/date';

export interface NoteTarget {
  scheduleId: string;
  studentId: string;
  studentName: string;
  sessionDate: string;
  slotNo: number;
  businessName: string;
  current: string;
}

interface Props {
  target: NoteTarget | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (text: string) => void;
}

/**
 * 授業記録の入力。
 *
 * 出欠と**同じ1行**に入る（ドメインの決定。別テーブルにすると「出欠だけある回」と
 * 「記録だけある回」ができて食い違う）。欠席にすると DB のトリガーが所見を落とすので、
 * 欠席の回はそもそもここを開けないようにしてある。
 */
export function LessonNoteSheet({ target, busy, onCancel, onSave }: Props) {
  const [text, setText] = useState('');

  /* 開くたびに今の記録を入れ直す。前に開いた生徒の下書きが残ると、別の生徒に書き込む */
  useEffect(() => { setText(target?.current ?? ''); }, [target]);

  return (
    <Sheet
      open={target !== null}
      title={target ? `${target.studentName} の授業記録` : '授業記録'}
      subtitle={target
        ? `${formatDayJa(target.sessionDate)} ${target.businessName} 第${target.slotNo}コマ`
        : undefined}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>やめる</Button>
          <span className="flex-1" />
          <Button variant="primary" onClick={() => onSave(text)} disabled={busy}>
            保存する
          </Button>
        </>
      }
    >
      <TextArea
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今日進めた内容や様子を書きます"
      />
      <p className="mt-sm text-[12px] leading-relaxed text-muted">
        ここに書いた内容は<strong className="text-ink">保護者のマイページにそのまま出ます。</strong>
        空にして保存すると記録を消せます。
      </p>
    </Sheet>
  );
}
