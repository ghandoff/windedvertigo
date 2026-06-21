"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type FilterOption = string | { value: string; label: string };

interface FilterSelectProps {
  paramKey: string;
  placeholder: string;
  options: readonly FilterOption[];
}

export function FilterSelect({ paramKey, placeholder, options }: FilterSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const current = searchParams.get(paramKey) ?? "";

  function onChange(value: string | null) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "__all__") {
        params.set(paramKey, value);
      } else {
        params.delete(paramKey);
      }
      router.push(`?${params.toString()}`);
    });
  }

  const normalised = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const currentLabel = normalised.find((o) => o.value === current)?.label ?? current;
  const displayText = current ? currentLabel : `All ${placeholder}`;

  return (
    <Select value={current || "__all__"} onValueChange={onChange}>
      <SelectTrigger className="w-44 text-sm">
        <span className={`flex flex-1 text-left truncate ${!current ? "text-muted-foreground" : ""}`}>
          {displayText}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {placeholder}</SelectItem>
        {normalised.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
