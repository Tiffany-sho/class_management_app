import { Card, Icon, type IconName } from '@/components/ui';
import { formatMonthJa } from '@/lib/date';

interface Props {
  overtime: number;
  absences: number;
  promotions: number;
  unconfirmedDays: number;
  month: string;
  onGo: (to: string) => void;
}

/**
 * 要対応。件数が 0 の項目も「なし」で出す。
 * 消えると「無い」のか「見落としている」のか分からなくなるため。
 */
export function TodoList({ overtime, absences, promotions, unconfirmedDays, month, onGo }: Props) {
  const items: { icon: IconName; title: string; detail: string; to: string; warn: boolean }[] = [
    {
      icon: 'file-check',
      title: `時間外勤務の承認待ち ${overtime}件`,
      detail: overtime ? '承認した分だけ給与に加算されます' : 'なし',
      to: '/overtime',
      warn: overtime > 0,
    },
    {
      icon: 'user-x',
      title: `未確認の欠席連絡 ${absences}件`,
      detail: absences ? '確認すると保護者と担当講師に通知されます' : 'なし',
      to: '/inbox',
      warn: absences > 0,
    },
    {
      icon: 'calendar',
      title: `${formatMonthJa(month)}の未確定 ${unconfirmedDays}日`,
      detail: unconfirmedDays ? '確定しないと保護者・講師に表示されません' : 'すべて確定済み',
      to: '/schedule',
      warn: unconfirmedDays > 0,
    },
    {
      icon: 'graduation',
      title: `進級によるコース変更 ${promotions}件`,
      detail: promotions ? '承認するまで旧コースのままです' : 'なし',
      to: '/promotion',
      warn: false,
    },
  ];

  return (
    <Card>
      {items.map((it, i) => (
        <button
          key={it.title}
          type="button"
          onClick={() => onGo(it.to)}
          className={`flex w-full items-start gap-sm px-md py-sm text-left hover:bg-surface-soft
            ${i < items.length - 1 ? 'border-b border-hairline' : ''}`}
        >
          <Icon name={it.icon} className={`mt-[2px] ${it.warn ? 'text-coral' : 'text-muted'}`} />
          <span className="min-w-0 flex-1">
            <span className={`block text-ui-md ${it.warn ? 'text-coral' : 'text-ink'}`}>
              {it.title}
            </span>
            <span className="mt-[3px] block text-ui-sm text-muted">{it.detail}</span>
          </span>
          <Icon name="chevron-right" size={16} className="mt-[2px] text-border-strong" />
        </button>
      ))}
    </Card>
  );
}
