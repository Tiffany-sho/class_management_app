import { Empty } from '@/components/ui';

/**
 * 未実装の画面。
 * 空白ではなく「まだ作っていない」と明示する。空白だと壊れて見える。
 * モックに該当画面があることも書いて、仕様を探す先を示す。
 */
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-lg text-title-md">{title}</h1>
      <div className="rounded-md border border-hairline bg-canvas shadow-card">
        <Empty
          title="この画面はまだ実装されていません"
          hint={
            <>
              仕様と見た目は <code className="rounded-sm bg-surface-strong px-[4px]">mock/index.html</code>{' '}
              にあります。ブラウザで開くと動く状態で確認できます。
            </>
          }
        />
      </div>
    </div>
  );
}
