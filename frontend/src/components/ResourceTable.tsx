import { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: (item: T) => ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

function ResourceTable<T>({ columns, data, emptyMessage }: Props<T>) {
  if (data.length === 0) {
    return <div className="loading">{emptyMessage ?? 'No resources found.'}</div>;
  }

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              {columns.map((column) => (
                <td key={column.header}>{column.accessor(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResourceTable;
