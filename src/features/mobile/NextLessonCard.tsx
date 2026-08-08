import { formatDayJa, formatTimeRange } from '@/lib/date';
import type { BusinessColorKey } from '@/types/domain';

interface Props {
  label: string;
  lesson: {
    sessionDate: string;
    /** 講師だけ。保護者には教室の内部の並び番号なので出さない */
    slotNo?: number;
    startTime: string;
    endTime: string;
    /** 2教室にまたがる人にだけ渡す。1教室しか無い人には自明 */
    businessName?: string;
    colorKey: BusinessColorKey;
    /** 担当講師など、下の行に足したいもの */
    detail?: string;
  } | null;
  /** 予定が無いときに出す文言 */
  emptyText: string;
}

/**
 * 次回の予定を出す色付きのカード。
 *
 * 面を事業の色（プログラミング=forest / イラスト=coral）で塗る。
 * **この画面で一番大きい要素にする** ―― 保護者も講師も、開いて最初に確かめるのは
 * 「次はいつか」で、それが一覧の中に埋もれていると毎回探すことになる。
 */
export function NextLessonCard({ label, lesson, emptyText }: Props) {
  if (!lesson) {
    return (
      <div className="mb-md rounded-md border border-hairline bg-canvas p-lg shadow-card">
        <div className="mb-[6px] text-ui-xs tracking-[0.06em] text-muted">{label}</div>
        <div className="text-ui-lg text-ink">{emptyText}</div>
      </div>
    );
  }

  const sub = [
    formatTimeRange(lesson.startTime, lesson.endTime),
    lesson.businessName,
    lesson.detail,
  ].filter(Boolean).join(' ・ ');

  return (
    <div
      className={`mb-md rounded-md p-lg text-on-dark
        ${lesson.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
    >
      <div className="mb-[6px] text-ui-xs tracking-[0.06em] opacity-85">{label}</div>
      <div className="text-ui-2xl font-medium leading-[1.25]">
        {formatDayJa(lesson.sessionDate)}
        {lesson.slotNo ? ` 第${lesson.slotNo}コマ` : ''}
      </div>
      <div className="mt-[6px] text-ui-base opacity-90 tnum">{sub}</div>
    </div>
  );
}
