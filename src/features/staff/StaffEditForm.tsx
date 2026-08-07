import { useState } from 'react';
import { Button, Chip, Field, Note, TextInput, useToast } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { setCommuteAllowance, setEmployeeBusinesses, setWageRate } from '@/lib/queries';
import { todayIso } from '@/lib/date';
import type { Business, StaffMember } from '@/types/domain';

/**
 * 講師の条件を設定する。
 *
 * **時給と交通費は上書きせず、適用開始日つきで新しい行を足す。**
 * 上書きすると、その時給で計算済みの過去の給与までさかのぼって変わる。
 * 既定の適用開始日は今日にしてある（過去に遡って足すと過去分が変わるため）。
 */
export function StaffEditForm({ staff, businesses, onSaved }: {
  staff: StaffMember;
  businesses: Business[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [bizIds, setBizIds] = useState<string[]>(staff.businessIds);
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(businesses.map((b) => [
      b.id,
      String(staff.wages.find((w) => w.businessId === b.id)?.hourlyRate ?? ''),
    ])));
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(businesses.map((b) => [
      b.id,
      staff.wages.find((w) => w.businessId === b.id)?.jobLabel
        ?? (b.colorKey === 'forest' ? 'プログラミング講師' : 'イラスト講師'),
    ])));
  const [commute, setCommute] = useState(String(staff.commuteDaily || ''));
  const [from, setFrom] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  const toggleBiz = (id: string) =>
    setBizIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    setBusy(true);
    try {
      await setEmployeeBusinesses(staff.id, bizIds);

      for (const b of businesses) {
        if (!bizIds.includes(b.id)) continue;
        const value = Number(String(rates[b.id] ?? '').replace(/[^\d]/g, ''));
        if (!value) continue;
        await setWageRate(staff.id, b.id, labels[b.id] || b.name, value, from);
      }

      const daily = Number(commute.replace(/[^\d]/g, ''));
      if (daily || staff.commuteDaily) await setCommuteAllowance(staff.id, daily, from);

      toast(`${staff.name} の条件を保存しました`);
      onSaved();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="担当できる教室" hint="ここに入っていない教室のコマには割り当てられません。">
        <div className="flex flex-wrap gap-xs">
          {businesses.map((b) => (
            <Chip key={b.id} active={bizIds.includes(b.id)} onClick={() => toggleBiz(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      </Field>

      {businesses.filter((b) => bizIds.includes(b.id)).map((b) => (
        <div key={b.id} className="mb-md grid grid-cols-2 gap-sm">
          <Field label={`${b.name} の業務名`}>
            <TextInput
              value={labels[b.id] ?? ''}
              onChange={(e) => setLabels((p) => ({ ...p, [b.id]: e.target.value }))}
            />
          </Field>
          <Field label="時給（円）">
            <TextInput
              inputMode="numeric"
              className="text-right tnum"
              value={rates[b.id] ?? ''}
              onChange={(e) => setRates((p) => ({ ...p, [b.id]: e.target.value }))}
            />
          </Field>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-sm">
        <Field label="交通費（1日・円）">
          <TextInput
            inputMode="numeric"
            className="text-right tnum"
            value={commute}
            onChange={(e) => setCommute(e.target.value)}
          />
        </Field>
        <Field label="適用開始日">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
      </div>

      <Note>
        <strong className="text-ink">過去の給与は変わりません。</strong>
        時給と交通費は適用開始日つきで履歴として積むので、この日より前の勤務は
        そのときの金額のまま計算されます。
        <strong className="text-ink">適用開始日を過去にすると、その期間の未確定の給与は再計算されます。</strong>
      </Note>

      <Button variant="primary" block disabled={busy} onClick={() => void save()}>
        条件を保存
      </Button>
    </div>
  );
}
