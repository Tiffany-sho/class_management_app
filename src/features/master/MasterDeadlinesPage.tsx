import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Button, Loading, ErrorNote, Note, Panel, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchDeadlineRules } from '@/lib/queries';
import type { DeadlineRule } from '@/types/domain';
import { DeadlineRuleSheet } from './DeadlineRuleSheet';

const TYPE_LABEL: Record<string, string> = {
  parent: '保護者（受講希望）',
  employee: '講師（勤務希望）',
};

type Target = DeadlineRule & { typeLabel: string };

/**
 * 締め切り設定。
 *
 * **ここにあるのはルールだけ。生成された各月の一覧は出さない。**
 * ルールを決めれば結果は決まるので、一覧も並べると
 * 「ルールと一覧のどちらが正か」が分からなくなる。
 *
 * **編集はドロワーの中だけ。** 受付が開く日を決める値で、押し間違うと
 * 保護者が提出できないまま締め切りを迎える。
 */
export function MasterDeadlinesPage() {
  const { toast } = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const state = useAsync(fetchDeadlineRules, []);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const rules = state.data ?? [];

  return (
    <div>
      <PageHeader
        title="締め切り設定"
        description="毎月このルールから、翌月ぶんの締め切りが自動で作られます。"
      />

      <Note>
        締め切りは<strong className="text-ink">「対象月の前月◯日◯時」</strong>という繰り返しで決まります。
        たとえば保護者が20日なら、9月ぶんの希望は8月20日が締め切りです。
        月末を超える指定（31日など）は、その月の末日に丸められます。
      </Note>

      <div className="grid gap-md app:grid-cols-2">
        {rules.map((r) => {
          const typeLabel = TYPE_LABEL[r.type] ?? r.type;
          return (
            <Panel key={r.id}>
              <h3 className="mb-xs text-[14px] font-medium text-ink">{typeLabel}</h3>
              <p className="mb-md text-[20px] text-ink tnum">
                前月 {r.dayOfMonth}日 {r.timeOfDay.slice(0, 5)}
              </p>
              <p className="mb-md text-[12px] text-muted">
                例）9月ぶんの提出は{' '}
                <strong className="text-ink">8月{r.dayOfMonth}日 {r.timeOfDay.slice(0, 5)}</strong> まで
              </p>
              <Button size="sm" onClick={() => setTarget({ ...r, typeLabel })}>
                変更する
              </Button>
            </Panel>
          );
        })}
      </div>

      <p className="mt-lg text-[12px] leading-relaxed text-muted">
        ここを変えても<strong className="text-ink">すでに作られた月の締め切りは動きません</strong>。
        締めたはずの月の日付が後から変わると、締め切りを過ぎた提出が通ってしまうためです。
        特定の月だけ変えたい・その月の受付を止めたいときは、
        Supabase のダッシュボードで <code>deadlines</code> の該当行を直接直してください
        （<code>active</code> を false にするとその月は受け付けなくなります）。
      </p>

      <DeadlineRuleSheet
        rule={target}
        onClose={() => setTarget(null)}
        onSaved={(m) => { toast(m); setTarget(null); state.reload(); }}
        onError={(m) => toast(m)}
      />
    </div>
  );
}
