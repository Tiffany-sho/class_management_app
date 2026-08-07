import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Button, Field, Loading, ErrorNote, Note, Panel, Select, TextInput, useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { fetchDeadlineRules, updateDeadlineRule } from '@/lib/queries';
import type { DeadlineRule } from '@/types/domain';

const TYPE_LABEL: Record<string, string> = {
  parent: '保護者（受講希望）',
  employee: '講師（勤務希望）',
};

/**
 * 締め切り設定。
 *
 * **ここにあるのはルールだけ。生成された各月の一覧は出さない。**
 * ルールを決めれば結果は決まるので、一覧も並べると
 * 「ルールと一覧のどちらが正か」が分からなくなる。
 *
 * 変更しても**すでに生成済みの月は動かない**。締めたはずの月の日付が後から
 * 変わると、締め切りを過ぎた提出が通ってしまうため。
 * 特定の月だけ変えたいときは `deadlines` の行を直接直す。
 */
export function MasterDeadlinesPage() {
  const { toast } = useToast();
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
        {rules.map((r) => (
          <RuleCard key={r.id} rule={r} onSaved={() => { toast('締め切りルールを変更しました'); state.reload(); }} onError={(m) => toast(m)} />
        ))}
      </div>

      <p className="mt-lg text-[12px] leading-relaxed text-muted">
        ここを変えても<strong className="text-ink">すでに作られた月の締め切りは動きません</strong>。
        締めたはずの月の日付が後から変わると、締め切りを過ぎた提出が通ってしまうためです。
        特定の月だけ変えたい・その月の受付を止めたいときは、
        Supabase のダッシュボードで <code>deadlines</code> の該当行を直接直してください
        （<code>active</code> を false にするとその月は受け付けなくなります）。
      </p>
    </div>
  );
}

function RuleCard({ rule, onSaved, onError }: {
  rule: DeadlineRule;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [day, setDay] = useState(String(rule.dayOfMonth));
  const [time, setTime] = useState(rule.timeOfDay.slice(0, 5));
  const [busy, setBusy] = useState(false);

  const dirty = Number(day) !== rule.dayOfMonth || time !== rule.timeOfDay.slice(0, 5);

  const save = async () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      onError('日は1〜31で指定してください。');
      return;
    }
    setBusy(true);
    try {
      await updateDeadlineRule(rule.id, n, `${time}:00`);
      onSaved();
    } catch (e) {
      onError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <h3 className="mb-md text-[14px] font-medium text-ink">{TYPE_LABEL[rule.type] ?? rule.type}</h3>

      <div className="grid grid-cols-2 gap-sm">
        <Field label="前月の何日">
          <Select value={day} onChange={(e) => setDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}日</option>
            ))}
          </Select>
        </Field>
        <Field label="時刻">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      <p className="mb-md text-[12px] text-muted">
        例）9月ぶんの提出は <strong className="text-ink">8月{day}日 {time}</strong> まで
      </p>

      <Button variant="primary" size="sm" disabled={!dirty || busy} onClick={() => void save()}>
        {dirty ? '変更を保存' : '変更なし'}
      </Button>
    </Panel>
  );
}
