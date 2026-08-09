import { Button, Note, Sheet } from '@/components/ui';

export interface SubmitLine {
  id: string;
  /** 誰のぶんか。講師は自分だけなので空でよい */
  name?: string;
  count: number;
}

interface Props {
  open: boolean;
  month: string;
  lines: SubmitLine[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 提出の確認。
 *
 * **提出は取り消せない**（提出済みの月は本人が直せない ―― RLS が弾く）。
 * 取り返しのつかない操作に確認を挟まないと、押してから気づくことになる。
 * ここだけは確認を出す ―― 候補の出し入れに確認を挟まないのとは逆の判断で、
 * 理由は「押し直せるかどうか」。
 *
 * **誰が何件で出るのかを1人ずつ出す。** 保護者はきょうだいぶんをまとめて出すので、
 * 片方の子を触っただけのつもりで、もう片方が0件のまま固まることが起きる。
 * 0件は「今月は通えない」という有効な内容なので、**エラーにはせず、そう見せる**。
 */
export function SubmitConfirmSheet({ open, month, lines, busy, onCancel, onConfirm }: Props) {
  const zero = lines.filter((l) => l.count === 0);

  return (
    <Sheet
      open={open}
      title="この内容で提出します"
      subtitle={month}
      onClose={onCancel}
      footer={
        <>
          <Button block onClick={onCancel} disabled={busy}>やめる</Button>
          <Button variant="primary" block onClick={onConfirm} disabled={busy}>提出する</Button>
        </>
      }
    >
      <ul className="mb-md">
        {lines.map((l) => (
          <li
            key={l.id}
            className="flex items-baseline gap-sm border-b border-hairline py-sm last:border-0"
          >
            {l.name ? <span className="text-ui-md text-ink">{l.name}</span> : null}
            <span className="flex-1" />
            <span className={`text-ui-md tnum ${l.count === 0 ? 'text-coral' : 'text-ink'}`}>
              {l.count === 0 ? '希望なし' : `${l.count}件`}
            </span>
          </li>
        ))}
      </ul>

      <Note icon="warning">
        <strong className="text-ink">提出すると、この月は変更できなくなります。</strong>
        締め切りより前でも直せません（教室が生徒と講師を組み始めるためです）。
        {zero.length > 0 ? (
          <>
            <br />
            <strong className="text-ink">
              {zero.map((l) => l.name).filter(Boolean).join('・') || 'この月'}
            </strong>
            は<strong className="text-ink">「希望なし」</strong>として提出されます。
          </>
        ) : null}
      </Note>
    </Sheet>
  );
}
