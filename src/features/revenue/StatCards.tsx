import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'ink' | 'forest' | 'coral';
}

const TONE = {
  ink: 'text-ink',
  forest: 'text-forest',
  coral: 'text-coral',
} as const;

/** 数字を並べる小さいカード。桁がずれると読み違えるので必ず等幅にする */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-lg grid gap-md sm:grid-cols-2 app:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="px-md py-sm">
          <div className="text-ui-sm text-muted">{s.label}</div>
          <div className={`mt-[4px] text-ui-xl font-medium tnum ${TONE[s.tone ?? 'ink']}`}>
            {s.value}
          </div>
          {s.hint ? <div className="mt-[2px] text-ui-sm text-muted">{s.hint}</div> : null}
        </Card>
      ))}
    </div>
  );
}
