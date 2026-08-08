import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Chip, DataTable, Icon, Loading, ErrorNote, Note, TextInput,
  useToast, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchAllUsers, type ManagedUser } from '@/lib/queries';
import { useAuth } from '@/features/auth/AuthProvider';
import { UserSheet } from './UserSheet';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  parent: '保護者',
  employee: '講師',
};

const ROLE_TONE = {
  admin: 'info',
  employee: 'prog',
  parent: 'neutral',
} as const;

/**
 * ユーザー・招待。
 *
 * **招待はこの画面からは行えない。** 招待には service_role キーが必要で、
 * その鍵をブラウザに置くと RLS を全部素通りできてしまう
 * （VITE_ 接頭辞の値はバンドルに焼き込まれて配布される）。
 * 当面は Supabase のダッシュボードから招待する。
 *
 * ここでできるのは、在籍/退職の切り替え（論理削除）だけ。
 * 行を消すと過去の実績や請求まで消えるので、消さずに無効にする。
 * **切り替えは行を押して開くドロワーの中だけ。** 一覧は名前を探すために触る場所で、
 * そこにボタンがあると、探している途中で人を無効にしてしまう。
 */
export function MasterUsersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | 'admin' | 'parent' | 'employee'>('all');
  const [target, setTarget] = useState<ManagedUser | null>(null);

  const state = useAsync(fetchAllUsers, []);

  const rows = useMemo(() => {
    let list = state.data ?? [];
    if (role !== 'all') list = list.filter((u) => u.role === role);
    if (query.trim()) {
      const q = query.trim();
      list = list.filter((u) => u.name.includes(q) || u.email.includes(q));
    }
    return list;
  }, [state.data, role, query]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;

  const columns: Column<ManagedUser>[] = [
    { key: 'name', header: '名前', render: (u) => (
      <div>
        <div className="text-ink">
          {u.name}
          {u.id === user?.id ? <span className="ml-xs text-[11px] text-muted">（自分）</span> : null}
        </div>
        <div className="text-[12px] text-muted">{u.email}</div>
      </div>
    ) },
    { key: 'role', header: '役割', render: (u) => (
      <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
    ) },
    { key: 'status', header: '状態', render: (u) => (
      u.active ? <Badge tone="success">在籍中</Badge> : <Badge tone="neutral">無効</Badge>
    ) },
    { key: 'action', header: '', render: () => (
      <span className="text-muted"><Icon name="chevron-right" size={16} /></span>
    ) },
  ];

  return (
    <div>
      <PageHeader title="ユーザー・招待" description={`${rows.length} / ${(state.data ?? []).length}名`} />

      <Note icon="warning">
        <strong className="text-ink">招待はこの画面からは行えません。</strong>
        招待には service_role キーが必要ですが、それをブラウザに置くと
        アクセス制御を全部素通りできる鍵が公開されてしまいます。
        Supabase のダッシュボードの <strong className="text-ink">Authentication → Users → Add user</strong> から作り、
        そのあと下の一覧で役割を確認してください。
        <br />
        招待時に User Metadata が入れられない場合、その人は<strong className="text-ink">保護者として作られます</strong>。
        講師にするときはダッシュボードの Table Editor で <code>public.users.role</code> を
        <code>employee</code> に変えてください。
      </Note>

      <div className="mb-md flex flex-wrap items-center gap-sm">
        <div className="relative max-w-[240px] flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            className="pl-[32px]"
            placeholder="名前・メールで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-xs">
          <Chip active={role === 'all'} onClick={() => setRole('all')}>すべて</Chip>
          <Chip active={role === 'employee'} onClick={() => setRole('employee')}>講師</Chip>
          <Chip active={role === 'parent'} onClick={() => setRole('parent')}>保護者</Chip>
          <Chip active={role === 'admin'} onClick={() => setRole('admin')}>管理者</Chip>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        onRowClick={setTarget}
        empty="該当するユーザーがいません。"
      />

      <p className="mt-md text-[12px] leading-relaxed text-muted">
        行を押すと詳細が開き、そこで<strong className="text-ink">在籍中 / 無効</strong>を切り替えられます。
        「無効にする」は<strong className="text-ink">論理削除</strong>なので、行は残り、
        過去の担当コマ・給与・請求の記録は消えません。
      </p>

      <UserSheet
        user={target}
        isSelf={Boolean(target && target.id === user?.id)}
        onClose={() => setTarget(null)}
        onSaved={(m) => { toast(m); setTarget(null); state.reload(); }}
        onError={(m) => toast(m)}
      />
    </div>
  );
}
