"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  { value: "bug", label: "\u{1F41B} bug" },
  { value: "confusion", label: "\u{1F635} confusion" },
  { value: "idea", label: "\u{1F4A1} idea" },
  { value: "praise", label: "\u{1F64C} praise" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setCategory(null);
    setDescription("");
    setLoading(false);
    setErrorMsg("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  async function handleSubmit() {
    if (!category || !description.trim()) {
      setErrorMsg("pick a category and describe what's up");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description: description.trim(), path: pathname }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error ?? "something went wrong");
        return;
      }

      setOpen(false);
      reset();
    } catch {
      setErrorMsg("failed to send — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="fixed bottom-6 right-6 z-50 gap-1.5" />
        }
      >
        <MessageSquare className="size-3.5" />
        feedback
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>send feedback</DialogTitle>
          <DialogDescription>let us know what you think</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              variant={category === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <Textarea
          placeholder="what's on your mind?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {loading ? "sending..." : "send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
