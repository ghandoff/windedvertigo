"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { lockOptionAction } from "./actions";

interface Props {
  pollId: string;
  optionId: string;
}

export function LockPollButton({ pollId, optionId }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => lockOptionAction(pollId, optionId))}
      className="text-xs"
    >
      {pending ? "locking…" : "lock this time"}
    </Button>
  );
}
