"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterSelectProps {
  paramKey: string;
  placeholder: string;
  options: readonly string[];
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

  return (
    <Select value={current || "__all__"} onValueChange={onChange}>
      <SelectTrigger className="w-44 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
