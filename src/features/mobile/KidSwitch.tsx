import { SectionLabel } from '@/components/ui';
import type { Business, Student } from '@/types/domain';

interface Props {
  students: Student[];
  businesses: Business[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * お子さま切替。
 *
 * 兄弟で通う教室もコースも違うので、**1人ずつに絞って見せる**。
 * 全員ぶんを1つの一覧に混ぜると、どの回が誰のものか読み取れない。
 * 1人だけのときも出す（切替が「増えたり消えたり」すると、
 * 兄弟が増えた保護者が操作を見つけられない）。
 */
export function KidSwitch({ students, businesses, selectedId, onSelect }: Props) {
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  return (
    <>
      <SectionLabel>お子さま</SectionLabel>
      <div className="mb-md flex gap-xs">
        {students.map((s) => {
          const b = bizMap.get(s.businessId);
          const on = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(s.id)}
              className={`flex-1 rounded-md border p-[10px] text-left
                ${on ? 'border-primary bg-surface-soft' : 'border-hairline bg-canvas'}`}
            >
              <span className="flex items-center gap-[6px] text-[14px] font-medium text-ink">
                <span
                  aria-hidden
                  className={`h-[9px] w-[9px] shrink-0 rounded-pill
                    ${b?.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="mt-[2px] block text-[11px] text-muted">
                {s.gradeLabel} ・ {b?.name?.replace('教室', '') ?? '—'} 月{s.sessionsPerMonth}回
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
