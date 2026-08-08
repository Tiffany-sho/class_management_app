import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** 数値列は右寄せ＋等幅にする。桁がずれると読み違えるため */
  numeric?: boolean;
  sortable?: boolean;
  /**
   * 長い自由記述だけ折り返しを許す（作業内容・備考など）。
   * **既定は折り返さない。** 氏名・教室名・コース名のような**それ以上短くできない語**が
   * 途中で折れると、幅が足りないのか2件あるのか読み分けられなくなる。
   */
  wrap?: boolean;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortAsc?: boolean;
  onSort?: (key: string) => void;
  empty: ReactNode;
  footer?: ReactNode;
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, sortKey, sortAsc, onSort, empty, footer,
}: Props<T>) {
  return (
    /**
     * **表は縮めない。入りきらないときは横スクロールにする。**
     * `w-full` だけだと、表は枠に合わせて縮み、列が足りなくなったぶんセルの中で
     * 文字が折り返す。「プログラミング教室」が3行になっても幅が足りないと分からず、
     * データが増えたようにも見える。`w-max min-w-full` にすると、
     * 表は中身の幅を保ち、足りないぶんはこの枠がスクロールする。
     */
    <div className="overflow-x-auto rounded-md border border-hairline bg-canvas shadow-card">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sortKey === c.key ? (sortAsc ? 'ascending' : 'descending') : undefined
                }
                className={`whitespace-nowrap px-md py-sm text-ui-sm font-medium text-muted
                  ${c.numeric ? 'text-right' : 'text-left'}`}
              >
                {c.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-[4px] hover:text-ink"
                  >
                    {c.header}
                    <span aria-hidden className="text-ui-2xs">
                      {sortKey === c.key ? (sortAsc ? '▲' : '▼') : ''}
                    </span>
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-md py-xl text-center text-ui-base text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => { if (e.key === 'Enter') onRowClick(row); }
                    : undefined
                }
                className={`border-b border-hairline last:border-0
                  ${onRowClick ? 'cursor-pointer hover:bg-surface-soft focus:bg-surface-soft focus:outline-none' : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-md py-sm align-middle text-ui-base
                      ${c.numeric ? 'text-right tnum' : 'text-left'}
                      ${c.wrap ? 'min-w-[240px] max-w-[420px]' : 'whitespace-nowrap'}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? <tfoot className="border-t border-border-strong">{footer}</tfoot> : null}
      </table>
    </div>
  );
}
