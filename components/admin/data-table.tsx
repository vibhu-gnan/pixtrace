import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  rowKey: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'No data found.',
  emptyIcon,
  rowKey,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-12 text-center">
        {emptyIcon && <div className="flex justify-center mb-3 text-gray-300">{emptyIcon}</div>}
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-gray-50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`px-6 py-4 ${col.className || ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
