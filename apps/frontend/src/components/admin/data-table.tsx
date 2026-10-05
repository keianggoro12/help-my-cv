"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: string;
  children: React.ReactNode;
}

export function DataTable({ minWidth = "720px", className, children, ...props }: DataTableProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // The outer wrapper provides the scroll boundary. When a menu is portalled it
  // must ignore this overflow clip, so the menu itself re-measures the viewport;
  // this wrapper exists only to stop the table from growing the layout on small
  // screens.
  const content = (
    <div
      {...props}
      className={[
        "relative overflow-x-auto rounded-2xl border bg-card text-sm shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <table className="w-full text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    // Avoid double wrappers when server-rendered: render the same markup but the
    // menu already portals to body. Keeping this simple is the reason this
    // component doesn't force a portal itself — it only guards against SSR.
    return content;
  }

  return content;
}

export function DataTableHead({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={[
        "border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-5 last:pr-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={[
        "border-b px-4 py-2 align-middle text-foreground/90 first:pl-5 last:pr-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </td>
  );
}

export function DataTableActionsCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={[
        "border-b px-4 py-2 text-right align-middle first:pl-5 last:pr-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex justify-end">{children}</div>
    </td>
  );
}

export function DataTableEmptyRow({
  colSpan,
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { colSpan: number }) {
  return (
    <tr>
      <td
        {...props}
        colSpan={colSpan}
        className={[
          "px-5 py-10 text-center text-sm text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </td>
    </tr>
  );
}