import type { ReactNode } from 'react';
import { Badge, Icon } from '@/components/ui';
import { formatDayJa, formatTimeRange } from '@/lib/date';
import { ATTENDANCE_LABEL, attendanceTone } from '@/lib/format';
import type { AttendanceStatus, BusinessColorKey } from '@/types/domain';

interface Props {
  sessionDate: string;
  slotNo: number;
  startTime: string;
  endTime: string;
  businessName: string;
  colorKey: BusinessColorKey;
  past: boolean;
  attendanceStatus?: AttendanceStatus | null;
  note?: string | null;
  notedByName?: string | null;
  /** 生徒名など、行ごとに足したいもの */
  extra?: ReactNode;
  action?: ReactNode;
}

/**
 * 1コマの表示。保護者のホームと講師の担当で共通に使う。
 *
 * 済んだ回は**出欠と授業記録を必ず同じ行に出す**。別の場所に置くと
 * 保護者が2か所を突き合わせることになるうえ、食い違ったときに気づけない。
 */
export function LessonItem({
  sessionDate, slotNo, startTime, endTime, businessName, colorKey,
  past, attendanceStatus, note, notedByName, extra, action,
}: Props) {
  return (
    <li className="border-b border-hairline px-md py-sm last:border-0">
      <div className="flex flex-wrap items-center gap-xs">
        <span
          aria-hidden
          className={`h-[9px] w-[9px] rounded-pill ${colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
        />
        <span className="text-[14px] text-ink">{formatDayJa(sessionDate)}</span>
        <span className="text-[12px] text-muted tnum">{formatTimeRange(startTime, endTime)}</span>
        <span className="text-[12px] text-muted">第{slotNo}コマ</span>
        {past && attendanceStatus ? (
          <Badge tone={attendanceTone(attendanceStatus)}>{ATTENDANCE_LABEL[attendanceStatus]}</Badge>
        ) : null}
        {past && !attendanceStatus ? <Badge tone="neutral">未マーク</Badge> : null}
        {!past ? <Badge tone="info">予定</Badge> : null}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>

      <div className="mt-[3px] text-[12px] text-muted">{businessName}</div>
      {extra}

      {past ? (
        <div className="mt-[5px] text-[12px] leading-relaxed text-muted">
          {attendanceStatus === 'absent' ? (
            '欠席のため授業記録はありません。'
          ) : note ? (
            <span className="flex items-start gap-[5px]">
              <Icon name="note" size={14} className="mt-[2px]" />
              <span>{note}{notedByName ? `（記録: ${notedByName}）` : ''}</span>
            </span>
          ) : (
            '授業記録はまだ記入されていません。'
          )}
        </div>
      ) : null}
    </li>
  );
}
