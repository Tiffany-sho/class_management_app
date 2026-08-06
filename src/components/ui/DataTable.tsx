import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** 数値列は右寄せ＋等幅にする。桁がずれると読み違えるため */
  numeric?: boolean;
  sortable?: boolean;
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
    <div className="overflow-x-auto rounded-md border border-hairline bg-canvas shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sortKey === c.key ? (sortAsc ? 'ascending' : 'descending') : undefined
                }
                className={`whitespace-nowrap px-md py-sm text-[12px] font-medium text-muted
                  ${c.numeric ? 'text-right' : 'text-left'}`}
              >
                {c.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-[4px] hover:text-ink"
                  >
                    {c.header}
                    <span aria-hidden className="text-[10px]">
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
              <td colSpan={columns.length} className="px-md py-xl text-center text-[13px] text-muted">
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
                    className={`px-md py-sm align-middle text-[13px]
                      ${c.numeric ? 'text-right tnum' : 'text-left'}`}
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
