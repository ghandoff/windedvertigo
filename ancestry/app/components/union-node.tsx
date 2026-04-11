"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export type UnionNodeData = {
  relType: string;
  label: string;
};

/** tiny junction node representing a couple's union — children descend from here */
export function UnionNode({ data }: NodeProps) {
  const d = data as unknown as UnionNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-0 !h-0 !border-0 !min-w-0 !min-h-0" />
      <div
        className="flex items-center justify-center"
        title={d.label}
      >
        <span className="text-[10px] font-medium text-muted-foreground select-none">
          {d.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-0 !h-0 !border-0 !min-w-0 !min-h-0" />
    </>
  );
}
