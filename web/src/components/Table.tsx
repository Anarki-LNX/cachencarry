import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table aria-label={label} className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, right, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-dim ${
        right ? "text-right" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  mono,
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean; mono?: boolean }) {
  return (
    <td
      className={`border-b border-line/60 px-3 py-2 align-middle ${right ? "num text-right" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-raised/50 ${className}`}>{children}</tr>;
}
