"use client";

/**
 * HintIcon — small info icon with a hover tooltip.
 *
 * A "use client" island that can be embedded anywhere — including inside
 * server components. The tooltip interaction runs only on the client.
 *
 * Usage:
 *   <HintIcon text="Players who opened any harbour game at least once today." />
 */

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface HintIconProps {
  /** Explanation shown on hover. */
  text: string;
  /** Visual size override. Defaults to h-3.5 w-3.5. */
  size?: string;
}

export function HintIcon({ text, size = "h-3.5 w-3.5" }: HintIconProps) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex items-center cursor-help shrink-0">
            <Info className={`${size} text-muted-foreground/60 hover:text-muted-foreground transition-colors`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
