import { formatDayJa, formatTimeRange } from '@/lib/date';
import type { BusinessColorKey } from '@/types/domain';

interface Props {
  label: string;
  lesson: {
    sessionDate: string;
    slotNo: number;
    startTime: string;
    endTime: string;
    businessName: string;
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
        <div className="mb-[6px] text-[11px] tracking-[0.06em] text-muted">{label}</div>
        <div className="text-[15px] text-ink">{emptyText}</div>
      </div>
    );
  }

  return (
    <div
      className={`mb-md rounded-md p-lg text-on-dark
        ${lesson.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
    >
      <div className="mb-[6px] text-[11px] tracking-[0.06em] opacity-85">{label}</div>
      <div className="text-[22px] font-medium leading-[1.25]">
        {formatDayJa(lesson.sessionDate)} 第{lesson.slotNo}コマ
      </div>
      <div className="mt-[6px] text-[13px] opacity-90 tnum">
        {formatTimeRange(lesson.startTime, lesson.endTime)} ・ {lesson.businessName}
        {lesson.detail ? ` ・ ${lesson.detail}` : ''}
      </div>
    </div>
  );
}
