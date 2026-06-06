"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DiscoverPanel } from "./discover-panel";
import { ImportPanel } from "./import-panel";
import { CitationForm } from "./citation-form";

type Tab = "find" | "paste" | "manual";

const TABS: { id: Tab; label: string }[] = [
  { id: "find", label: "find online" },
  { id: "paste", label: "paste a list" },
  { id: "manual", label: "type it in" },
];

// Single entry point for adding citations — three modes behind one button.
export function AddCitationsDialog({ allAssets }: { allAssets: string[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("find");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTab("find");
      }}
    >
      <DialogTrigger render={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          add citations
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>add citations</DialogTitle>
        </DialogHeader>

        {/* mode tabs */}
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="pt-1">
          {tab === "find" && <DiscoverPanel allAssets={allAssets} />}
          {tab === "paste" && <ImportPanel allAssets={allAssets} />}
          {tab === "manual" && <CitationForm allAssets={allAssets} onDone={() => setOpen(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
