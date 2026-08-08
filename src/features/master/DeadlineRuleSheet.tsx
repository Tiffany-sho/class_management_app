import { useEffect, useState } from 'react';
import { Button, Field, Select, Sheet, TextInput } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { updateDeadlineRule } from '@/lib/queries';
import type { DeadlineRule } from '@/types/domain';

interface Props {
  /** null なら閉じている */
  rule: (DeadlineRule & { typeLabel: string }) | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * 締め切りルールの編集。
 *
 * **一覧の上では直接編集させない。** 受付が開く日を決める値なので、
 * 押し間違いで動くと、保護者が提出できないまま締め切りを迎える。
 */
export function DeadlineRuleSheet({ rule, onClose, onSaved, onError }: Props) {
  const [day, setDay] = useState('20');
  const [time, setTime] = useState('23:59');
  const [busy, setBusy] = useState(false);

  // 開くたびに現在値へ戻す。前に開いたときの入力が残ると別のルールに書き込む
  useEffect(() => {
    if (!rule) return;
    setDay(String(rule.dayOfMonth));
    setTime(rule.timeOfDay.slice(0, 5));
  }, [rule]);

  const dirty = Boolean(rule)
    && (Number(day) !== rule!.dayOfMonth || time !== rule!.timeOfDay.slice(0, 5));

  const save = async () => {
    if (!rule) return;
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      onError('日は1〜31で指定してください。');
      return;
    }
    setBusy(true);
    try {
      await updateDeadlineRule(rule.id, n, `${time}:00`);
      onSaved(`${rule.typeLabel} の締め切りを 前月${n}日 ${time} に変更しました`);
    } catch (e) {
      onError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(rule)}
      onClose={onClose}
      title="締め切りルールの変更"
      subtitle={rule?.typeLabel}
      footer={
        <>
          <Button block onClick={onClose}>やめる</Button>
          <Button variant="primary" block disabled={!dirty || busy} onClick={() => void save()}>
            {dirty ? '変更を保存' : '変更なし'}
          </Button>
        </>
      }
    >
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

      <p className="mb-md text-[13px] text-muted">
        例）9月ぶんの提出は <strong className="text-ink">8月{day}日 {time}</strong> まで
      </p>

      <p className="text-[12px] leading-relaxed text-muted">
        ここを変えても<strong className="text-ink">すでに作られた月の締め切りは動きません</strong>。
        締めたはずの月の日付が後から変わると、締め切りを過ぎた提出が通ってしまうためです。
        月末を超える指定（31日など）は、その月の末日に丸められます。
      </p>
    </Sheet>
  );
}
