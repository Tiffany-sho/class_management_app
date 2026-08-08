import { useState } from 'react';
import { Badge, Button, Field, Sheet, TextInput } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { updateCourse } from '@/lib/queries';
import { yen } from '@/lib/format';
import type { Course } from '@/types/domain';

interface Props {
  /** 同じ学年区分のコース（月2回・月3回）。null なら閉じている */
  target: { businessName: string; gradeLabel: string; courses: Course[] } | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * コース料金の編集。
 *
 * **表から直接は編集させない。** 表の中に入力欄を置くと、一覧を眺めている途中で
 * 触れてしまい、気づかないうちに料金が変わる。料金は請求に直結するので、
 * 「開く → 直す → 保存する」の3手を必ず踏ませる。
 */
export function CourseFeeSheet({ target, onClose, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const close = () => { setDraft({}); onClose(); };

  const valueOf = (c: Course) => draft[c.id] ?? String(c.monthlyFee);
  const numberOf = (c: Course) => Number(valueOf(c).replace(/[^\d]/g, ''));

  const changed = (target?.courses ?? []).filter((c) => {
    const n = numberOf(c);
    return Number.isFinite(n) && n !== c.monthlyFee;
  });

  const save = async () => {
    if (!target) return;
    const invalid = target.courses.find((c) => {
      const n = numberOf(c);
      return !Number.isFinite(n) || n < 0;
    });
    if (invalid) {
      onError('金額は0以上の数字で入れてください。');
      return;
    }
    setBusy(true);
    try {
      // 変えたものだけ送る。触っていない行に update を投げると updated_at だけが動く
      for (const c of changed) await updateCourse(c.id, { monthlyFee: numberOf(c) });
      onSaved(`${target.gradeLabel} の料金を ${changed.length}件 変更しました`);
      setDraft({});
    } catch (e) {
      onError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const range = target?.courses[0];

  return (
    <Sheet
      open={Boolean(target)}
      onClose={close}
      title={target ? `${target.gradeLabel} の料金` : ''}
      subtitle={target
        ? `${target.businessName}${range ? ` ・ 対象学年 ${range.gradeMin}〜${range.gradeMax}` : ''}`
        : undefined}
      footer={
        <>
          <Button block onClick={close}>やめる</Button>
          <Button
            variant="primary"
            block
            disabled={busy || changed.length === 0}
            onClick={() => void save()}
          >
            {changed.length === 0 ? '変更なし' : `保存する（${changed.length}件）`}
          </Button>
        </>
      }
    >
      {(target?.courses ?? [])
        .slice()
        .sort((a, b) => a.sessionsPerMonth - b.sessionsPerMonth)
        .map((c) => (
          <Field
            key={c.id}
            label={
              <span className="flex items-center gap-xs">
                月{c.sessionsPerMonth}回
                {c.isDefault ? <Badge tone="info">標準</Badge> : null}
              </span>
            }
            hint={`現在 ${yen(c.monthlyFee)}`}
          >
            <TextInput
              className="tnum"
              inputMode="numeric"
              value={valueOf(c)}
              onChange={(e) => setDraft((p) => ({ ...p, [c.id]: e.target.value }))}
              aria-label={`月${c.sessionsPerMonth}回の月額`}
            />
          </Field>
        ))}

      <p className="text-[12px] leading-relaxed text-muted">
        ここを変えても<strong className="text-ink">すでに発行した月謝は変わりません</strong>。
        請求額は発行した時点でコピーして保存しているためです。変わるのは次に発行する月からです。
      </p>
    </Sheet>
  );
}
