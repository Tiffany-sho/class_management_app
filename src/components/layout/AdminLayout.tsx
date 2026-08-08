import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ADMIN_NAV } from './navItems';
import { Icon } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * 管理者のシェル。
 * 900px 未満でサイドバーがドロワーになる（shift_manage_app と同じ挙動）。
 * 画面ごとのヘッダーボタンは各ページが PageHeader で差し込む。
 *
 * スクロールについて: 外枠を画面の高さに固定し（h-dvh + overflow-hidden）、
 * サイドバーの nav と本文がそれぞれ自分で縦スクロールする。
 * 外枠にスクロールを許すとページ全体が1本のスクロールになり、
 * サイドバーを送ったつもりで本文まで動いてしまう。
 */
export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  // 画面を移ったらドロワーは閉じる（開いたまま残ると背面が触れない）
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-soft">
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[rgba(24,29,38,.34)] app:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-hairline
          bg-canvas transition-transform app:static app:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-sm border-b border-hairline px-md py-md">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-ui-lg font-medium text-on-primary">
            R
          </div>
          <div className="min-w-0">
            <div className="whitespace-nowrap text-ui-md font-medium text-ink">R-Tech 管理</div>
            <div className="text-ui-2xs tracking-[0.08em] text-muted">ADMIN CONSOLE</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-xs py-sm">
          {ADMIN_NAV.map((g) => (
            <div key={g.group} className="mb-sm">
              <div className="px-sm py-[6px] text-ui-2xs font-medium tracking-[0.08em] text-muted">
                {g.group}
              </div>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-sm rounded-md px-sm py-[9px] text-ui-base transition-colors
                     ${isActive
                       ? 'bg-primary text-on-primary'
                       : 'text-body hover:bg-surface-soft hover:text-ink'}`
                  }
                >
                  <Icon name={item.icon} size={17} />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* 氏名は長さが読めないので、**幅を取り合わせない**。
            ログアウトを同じ行に置くと氏名の取り分が減り、長い名前が「田中 さと…」になる。
            名前に1行まるごと与えて、ログアウトは下へ落とす。 */}
        <div className="border-t border-hairline px-md py-sm">
          <div className="flex items-center gap-sm">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-surface-strong text-ui-base text-ink">
              {user?.name?.[0] ?? '—'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ui-base leading-snug text-ink">{user?.name ?? '—'}</div>
              <div className="text-ui-xs text-muted">管理者</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-xs w-full rounded-md border border-hairline py-[5px] text-ui-sm
              text-ink hover:border-border-strong"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-sm border-b border-hairline bg-canvas
            px-md py-sm text-ui-md text-ink app:hidden"
          aria-label="メニューを開く"
        >
          <Icon name="menu" /> メニュー
        </button>

        <main className="min-w-0 flex-1 overflow-y-auto px-md py-lg app:px-xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** 各ページの見出し。右側にその画面だけのボタンを置く（全画面共通のボタンは置かない） */
export function PageHeader({
  title, description, actions,
}: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-lg flex flex-wrap items-start gap-md">
      <div className="min-w-0 flex-1">
        <h1 className="text-title-md">{title}</h1>
        {description ? (
          <p className="mt-[4px] text-ui-base leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-xs">{actions}</div> : null}
    </header>
  );
}
