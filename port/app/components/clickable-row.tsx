"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import type { ComponentProps, MouseEvent } from "react";

interface ClickableRowProps extends ComponentProps<typeof TableRow> {
  href: string;
}

export function ClickableRow({ href, children, className, ...props }: ClickableRowProps) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    e.preventDefault();
    router.push(href);
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={`cursor-pointer hover:bg-muted/50 ${className ?? ""}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      {...props}
    >
      {children}
    </TableRow>
  );
}
