"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addFindingAction } from "../actions";

export function AddFindingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("");
  const [citation, setCitation] = useState("");
  const [relevance, setRelevance] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!domain.trim()) return setError("domain is required");
    if (!title.trim()) return setError("title is required");
    if (!summary.trim()) return setError("summary is required");

    startTransition(async () => {
      const res = await addFindingAction({
        domain,
        title,
        summary,
        source: source || undefined,
        citation: citation || undefined,
        relevance: relevance || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDomain("");
      setTitle("");
      setSummary("");
      setSource("");
      setCitation("");
      setRelevance("");
      setTags("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          new finding
        </Button>
      } />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>new finding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="domain">domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. threshold concepts"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="clear descriptive title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="1–3 sentence distilled insight"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="relevance">relevance (optional)</Label>
            <Input
              id="relevance"
              value={relevance}
              onChange={(e) => setRelevance(e.target.value)}
              placeholder="how it connects to what we're building"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="source">source (optional)</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="author + title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="citation">citation (optional)</Label>
              <Input
                id="citation"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="author, year, journal"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">tags (comma-separated, optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="music, retention, embodied-cognition"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "saving…" : "add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
