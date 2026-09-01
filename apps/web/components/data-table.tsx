export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="admin-card overflow-hidden !p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/8 bg-white/[0.03] text-xs uppercase text-white/40">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {rows.map((row, index) => (
            <tr key={index} className="transition-colors hover:bg-white/[0.04]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-white/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
