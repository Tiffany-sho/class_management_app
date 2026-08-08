import { Button, Note, Sheet } from '@/components/ui';
import { formatDayJa } from '@/lib/date';

export interface RemoveTarget {
  kind: 'student' | 'employee';
  id: string;
  name: string;
  businessName: string;
  sessionDate: string;
  slotNo: number;
  overCapacity: boolean;
  /** 外すと担当が0名になるか。講師のときだけ意味がある */
  lastEmployee: boolean;
}

interface Props {
  target: RemoveTarget | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * **確定済みのコマ**から人を外すときの確認。
 *
 * 出すのはここだけ。下書きは1クリックで出し入れできる（まだ誰にも出していないので、
 * 間違えても押し直せば済む）。確定済みは保護者・講師の画面にもう出ていて、
 * 講師なら給与にも効いているので、眺めているつもりで触れて消えるのが一番まずい。
 */
export function RemovePickSheet({ target, busy, onCancel, onConfirm }: Props) {
  const t = target;
  const isEmployee = t?.kind === 'employee';

  return (
    <Sheet
      open={t !== null}
      title={isEmployee ? '担当から外しますか？' : '受講から外しますか？'}
      subtitle={t ? `${formatDayJa(t.sessionDate)} ${t.businessName} 第${t.slotNo}コマ` : undefined}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>やめる</Button>
          <span className="flex-1" />
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {t ? `${t.name} を外す` : '外す'}
          </Button>
        </>
      }
    >
      {t ? (
        <>
          <Note icon="warning">
            <strong className="text-ink">このコマはすでに確定しています。</strong>
            保護者・講師の画面にもう出ているので、外すと相手の予定からも消えます。
          </Note>

          <p className="mb-md text-[15px] text-ink">
            <strong>{t.name}</strong> をこのコマから外します。
          </p>

          {isEmployee ? (
            <ul className="mb-md flex flex-col gap-sm text-[13px] text-body">
              <li>
                <strong className="text-ink">この回は勤務実績から消え、給与もそのぶん下がります。</strong>
                確定したコマが、そのまま出勤日・勤務時間になるためです。
              </li>
              <li>
                担当が減ると<strong className="text-ink">定員も減ります</strong>
                （定員 = 担当講師の人数 × 事業ごとの係数）。生徒がそのままなら定員超過になります。
              </li>
              {t.lastEmployee ? (
                <li className="text-coral">
                  <strong>この人を外すと担当が0名になります。</strong>このままでは開催できません。
                </li>
              ) : null}
            </ul>
          ) : (
            <ul className="mb-md flex flex-col gap-sm text-[13px] text-body">
              <li>
                <strong className="text-ink">「この日に来る予定だった」ことごと消えます。</strong>
                保護者のマイページからも無くなります。
              </li>
              <li>
                当日休むだけなら、外さずに<strong className="text-ink">「当日の変更」で欠席にしてください</strong>。
                月謝は固定月額なので、欠席にしても請求額は変わりません。
              </li>
              {t.overCapacity ? (
                <li>
                  定員超過を直したいだけなら、
                  <strong className="text-ink">先に講師を1名足すほうが先です</strong>。
                  講師を足すと定員が伸びて、誰も外さずに超過が消えます。
                </li>
              ) : null}
            </ul>
          )}

          <p className="text-[12px] text-muted">
            希望は提出されたまま残るので、外してももう一度押せば入れ直せます。
          </p>
        </>
      ) : null}
    </Sheet>
  );
}
