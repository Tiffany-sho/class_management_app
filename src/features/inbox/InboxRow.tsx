import type { ReactNode } from 'react';
import { Badge, Icon, type IconName } from '@/components/ui';
import { sinceLabel } from '@/lib/date';

export interface InboxItem {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  /** 届いた時刻。並べ替えと「n時間前」の表示に使う */
  at: string;
  /** true = まだ管理者が何かする必要がある。一覧の上に来る */
  needsAction: boolean;
  actions?: ReactNode;
}

/** 受信ボックスの1件。要対応かどうかを色だけでなく必ず文字でも示す */
export function InboxRow({ item, last }: { item: InboxItem; last: boolean }) {
  return (
    <li
      className={`flex flex-wrap items-start gap-sm px-md py-sm
        ${last ? '' : 'border-b border-hairline'}
        ${item.needsAction ? 'bg-cream' : ''}`}
    >
      <Icon
        name={item.icon}
        className={`mt-[3px] shrink-0 ${item.needsAction ? 'text-coral' : 'text-muted'}`}
      />
      {/* **本文に最低幅を与える。** min-w-0 だと右のボタンに幅を全部取られ、
          スマホでは本文が 90px ほどに潰れて「8月2日 / （日）・第2コ / マ・…」と
          5行に折れる。最低幅があると、入らないときにボタンが次の行へ落ちる。 */}
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-xs">
          <span className="text-ui-md text-ink">{item.title}</span>
          {item.needsAction ? <Badge tone="warn">要対応</Badge> : null}
        </div>
        <div className="mt-[3px] text-ui-sm leading-relaxed text-muted">{item.detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-xs">
        <span className="text-ui-xs text-muted">{sinceLabel(item.at)}</span>
        {item.actions}
      </div>
    </li>
  );
}
