import React, { ReactNode } from "react";

// Props for Table
interface TableProps {
  children: ReactNode;
  className?: string;
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode;
  className?: string;
}

// Props for TableCell
interface TableCellProps {
  children: ReactNode;
  isHeader?: boolean;
  className?: string;
  colSpan?: number;
}

// Table Component — horizontal scroll inside wide layouts (grid/flex) without overflow
const Table: React.FC<TableProps> = ({ children, className }) => {
  return (
    <div
      className="relative isolate w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
      role="region"
      aria-label="Scrollable table"
    >
      <table
        className={`min-w-full border-collapse divide-y divide-gray-200 text-left dark:divide-gray-700 ${className ?? ""}`}
      >
        {children}
      </table>
    </div>
  );
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className }) => {
  return (
    <thead className={`bg-gray-50 dark:bg-white/3 ${className ?? ""}`}>
      {children}
    </thead>
  );
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className }) => {
  return (
    <tbody className={`divide-y divide-gray-100 dark:divide-gray-800 ${className ?? ""}`}>
      {children}
    </tbody>
  );
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className }) => {
  return (
    <tr className={`transition-colors hover:bg-gray-50/50 dark:hover:bg-white/2 ${className ?? ""}`}>
      {children}
    </tr>
  );
};

// TableCell Component
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className,
  colSpan,
}) => {
  if (isHeader) {
    return (
      <th
        colSpan={colSpan}
        className={`px-3 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-wider wrap-break-word text-gray-500 sm:px-5 sm:py-3 dark:text-gray-400 ${className ?? ""}`}
      >
        {children}
      </th>
    );
  }
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-3 text-sm align-top wrap-break-word text-gray-700 sm:px-5 sm:py-4 dark:text-gray-300 ${className ?? ""}`}
    >
      {children}
    </td>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
export { TablePagination } from "./TablePagination";
