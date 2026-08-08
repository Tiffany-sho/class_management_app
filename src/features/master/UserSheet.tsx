import { useState } from 'react';
import { Badge, Button, Note, Sheet } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { setUserActive, type ManagedUser } from '@/lib/queries';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  parent: '保護者',
  employee: '講師',
};

interface Props {
  /** null なら閉じている */
  user: ManagedUser | null;
  /** ログイン中の本人。自分は無効にできない（締め出されるため） */
  isSelf: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * ユーザーの詳細と、在籍 / 無効の切り替え。
 *
 * **一覧の行にボタンを置かない。** 一覧は名前を探すために触る場所で、
 * そこに切り替えボタンがあると、探している途中で人を無効にしてしまう。
 * 無効にすると本人はログインしても何も見えなくなる。
 */
export function UserSheet({ user, isSelf, onClose, onSaved, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await setUserActive(user.id, !user.active);
      onSaved(`${user.name} を${user.active ? '無効' : '在籍中'}にしました`);
    } catch (e) {
      onError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(user)}
      onClose={onClose}
      title={user?.name ?? ''}
      subtitle={user?.email}
      footer={
        <>
          <Button block onClick={onClose}>閉じる</Button>
          {user && !isSelf ? (
            <Button
              variant={user.active ? 'danger' : 'primary'}
              block
              disabled={busy}
              onClick={() => void toggle()}
            >
              {user.active ? '無効にする' : '在籍中に戻す'}
            </Button>
          ) : null}
        </>
      }
    >
      <dl className="mb-lg grid grid-cols-[88px_1fr] gap-y-sm text-[13px]">
        <dt className="text-muted">役割</dt>
        <dd className="text-ink">{user ? ROLE_LABEL[user.role] ?? user.role : '—'}</dd>
        <dt className="text-muted">状態</dt>
        <dd>
          {user?.active
            ? <Badge tone="success">在籍中</Badge>
            : <Badge tone="neutral">無効</Badge>}
        </dd>
        <dt className="text-muted">メール</dt>
        <dd className="break-all text-ink">{user?.email ?? '—'}</dd>
      </dl>

      {isSelf ? (
        <Note icon="warning">
          ログイン中の自分は無効にできません。無効にすると、その場で自分が締め出されます。
        </Note>
      ) : null}

      <p className="text-[12px] leading-relaxed text-muted">
        「無効にする」は<strong className="text-ink">論理削除</strong>です。行は残るので、
        過去の担当コマ・給与・請求の記録は消えません。
        ただし<strong className="text-ink">本人はログインしても何も見えなくなります</strong>。
        役割（管理者・講師・保護者）の変更はこの画面ではできません。
        Supabase のダッシュボードの Table Editor で <code>public.users.role</code> を直してください。
      </p>
    </Sheet>
  );
}
