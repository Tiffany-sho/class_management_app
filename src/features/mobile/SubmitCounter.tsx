import type { Deadline } from '@/types/domain';
import { untilLabel } from '@/lib/date';

interface Props {
  /** 選択中の数 */
  count: number;
  /** コースの上限。講師は上限が無いので省く */
  max?: number;
  deadline: Deadline | null;
}

/**
 * 選択中の数と締め切りを並べる帯。
 *
 * **締め切りはここにしか出さない。** 月送りの見出しにも出すと同じ日付が2つ並び、
 * 片方だけ更新されたときに気づけない。
 */
export function SubmitCounter({ count, max, deadline }: Props) {
  const closed = !deadline || !deadline.active
    || new Date(deadline.deadlineAt).getTime() < Date.now();

  return (
    <div className="mb-sm flex items-center gap-sm rounded-md border border-hairline
      bg-surface-soft px-[14px] py-sm">
      <div>
        <div className="text-ui-sm text-muted">選択中</div>
        <div className="text-ui-xl font-medium text-ink tnum">
          {count}{max === undefined ? '' : ` / ${max}`} コマ
        </div>
      </div>
      <div className="flex-1" />
      <div className="text-right">
        <div className="text-ui-sm text-muted">締切</div>
        <div className="text-ui-base text-ink tnum">
          {!deadline ? (
            <span className="text-coral">未定</span>
          ) : !deadline.active ? (
            <span className="text-coral">受付停止中</span>
          ) : closed ? (
            <span className="text-coral">締め切り済み</span>
          ) : (
            <>
              {new Date(deadline.deadlineAt).toLocaleString('ja-JP', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
              <span className="ml-xs text-muted">（{untilLabel(deadline.deadlineAt)}）</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
