import { useEffect, useMemo, useState } from 'react';
import {
  Button, Field, Note, Select, Sheet, TextInput, useToast,
} from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { createStudent, updateStudent } from '@/lib/queries';
import { academicYear, gradeLabel } from '@/lib/date';
import { yen } from '@/lib/format';
import type { Business, Course, Student } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  businesses: Business[];
  courses: Course[];
  parents: { id: string; name: string }[];
  /** 渡すと編集、渡さないと新規 */
  student?: Student | null;
}

/**
 * 生徒の登録・編集。
 *
 * **学年は保存しない。**「小1になった年度」を保存し、学年は毎回計算する。
 * 学年を保存すると毎年4月に全生徒の一括更新が必要になり、その実行漏れが
 * 全生徒の料金誤りに直結する。入学年度は後から変わらない事実なので保存に向く。
 *
 * コースは「事業 × 学年区分 × 月回数」で決まるので、直接選ばせずに
 * 学年と回数から引く。学年区分の取り違えを起こさないため。
 */
export function StudentForm({
  open, onClose, onSaved, businesses, courses, parents, student,
}: Props) {
  const { toast } = useToast();
  const thisYear = academicYear();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [year, setYear] = useState(thisYear);
  const [sessions, setSessions] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(student?.name ?? '');
    setParentId(student?.parentId ?? parents[0]?.id ?? '');
    setBusinessId(student?.businessId ?? businesses[0]?.id ?? '');
    setYear(student?.enrollmentYear ?? thisYear);
    setSessions(student?.sessionsPerMonth ?? 2);
  }, [open, student, parents, businesses, thisYear]);

  const grade = thisYear - year + 1;

  /** 学年と回数から該当コースを引く。無ければ登録させない（DB でも弾かれる） */
  const course = useMemo(() => courses.find(
    (c) => c.businessId === businessId && c.active
      && c.sessionsPerMonth === sessions
      && grade >= c.gradeMin && grade <= c.gradeMax,
  ), [courses, businessId, sessions, grade]);

  const submit = async () => {
    if (!name.trim()) { toast('氏名を入れてください。'); return; }
    if (!parentId) { toast('保護者を選んでください。'); return; }
    if (!course) { toast('この学年・回数に対応するコースがありません。'); return; }

    setBusy(true);
    try {
      const input = {
        name: name.trim(), parentId, businessId, courseId: course.id, enrollmentYear: year,
      };
      if (student) {
        await updateStudent(student.id, input);
        toast(`${input.name} の情報を更新しました`);
      } else {
        await createStudent(input);
        toast(`${input.name} を登録しました`);
      }
      onSaved();
      onClose();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const years = Array.from({ length: 13 }, (_, i) => thisYear - i);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={student ? '生徒の情報を編集' : '生徒を登録'}
      subtitle={student ? student.name : '保護者を先に招待しておく必要があります'}
      footer={
        <div className="flex gap-sm">
          <Button block onClick={onClose}>やめる</Button>
          <Button variant="primary" block disabled={busy} onClick={() => void submit()}>
            {student ? '保存' : '登録'}
          </Button>
        </div>
      }
    >
      <Field label="氏名">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="例）田中 陽翔" />
      </Field>

      <Field label="保護者" hint="アカウントは招待でしか作れません。先にユーザー・招待から登録してください。">
        <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          {parents.length === 0 ? <option value="">保護者が登録されていません</option> : null}
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>

      <Field label="教室">
        <Select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>

      <Field label="小1になった年度" hint={`いまの学年: ${gradeLabel(grade)}（学年は保存せず、この年度から毎年計算します）`}>
        <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>{y}年度（{gradeLabel(thisYear - y + 1)}）</option>
          ))}
        </Select>
      </Field>

      <Field label="月の回数">
        <Select value={String(sessions)} onChange={(e) => setSessions(Number(e.target.value))}>
          <option value="2">月2回</option>
          <option value="3">月3回</option>
        </Select>
      </Field>

      {course ? (
        <Note>
          コースは <strong className="text-ink">{course.gradeLabel} 月{course.sessionsPerMonth}回</strong>、
          月額 <strong className="text-ink">{yen(course.monthlyFee)}</strong> になります。
          {course.isDefault ? 'この学年区分の標準コースです。' : 'この学年区分の標準ではないコースです。'}
        </Note>
      ) : (
        <Note icon="warning">
          <strong className="text-ink">この学年・回数に対応するコースがありません。</strong>
          中学を卒業した学年か、コース・料金のマスタに該当の行が無い可能性があります。
        </Note>
      )}
    </Sheet>
  );
}
