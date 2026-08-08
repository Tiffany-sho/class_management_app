import { NavLink, Outlet } from 'react-router-dom';
import { tabsFor } from './navItems';
import { Icon } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { UserRole } from '@/types/domain';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理者',
  parent: '保護者',
  employee: '講師',
};

/**
 * 保護者・講師のシェル。ボトムタブは iOS のタブ構成と同じものにする。
 * タブバーの高さぶん本文に余白を入れないと、最後の要素が隠れる。
 */
export function MobileLayout({ title }: { title: string }) {
  const { user, role, signOut } = useAuth();
  const tabs = tabsFor(role ?? 'parent');

  /* 画面が広いときは横幅も広げる。文字だけ大きくして枠を 520px に留めると、
     1行に入る文字が減って行数がかえって増える */
  return (
    <div className="mx-auto flex min-h-full max-w-[520px] flex-col bg-surface-soft app:max-w-[680px]">
      <header className="sticky top-0 z-30 flex items-center gap-sm border-b border-hairline bg-canvas px-md py-sm">
        {/* 画面名は決まった短い語なので折らない。氏名は長さが読めないので、
            入りきらないときは**省略記号ではなく折り返す**（読めなくなるより読める方がまし）。 */}
        <div className="min-w-0 flex-1">
          <h1 className="whitespace-nowrap text-title-sm">{title}</h1>
          <p className="text-ui-sm leading-snug text-muted">
            {user?.name ?? '—'}（{ROLE_LABEL[role ?? 'parent']}）
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="shrink-0 whitespace-nowrap text-ui-sm text-link underline"
        >
          ログアウト
        </button>
      </header>

      {/* タブバーの高さぶん。文字を大きくしたぶんタブも高くなるので余白も増やす */}
      <main className="flex-1 px-md py-md pb-[100px]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[520px] border-t border-hairline bg-canvas app:max-w-[680px]"
        aria-label="メインメニュー"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-[2px] py-[9px] text-ui-2xs
               ${isActive ? 'text-ink' : 'text-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={t.icon} size={20} className={isActive ? '' : 'opacity-70'} />
                <span className={isActive ? 'font-medium' : ''}>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
