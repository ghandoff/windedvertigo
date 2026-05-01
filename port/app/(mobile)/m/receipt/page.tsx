"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/pwa/use-current-user";

type Step = "capture" | "saving" | "done";

export default function ReceiptCapturePage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setErrorMsg("");
    },
    [],
  );

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [preview]);

  const handleSubmit = useCallback(async () => {
    if (!amount || Number(amount) <= 0) {
      setErrorMsg("enter an amount");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("describe what this is for");
      return;
    }

    setStep("saving");
    setErrorMsg("");

    try {
      // 1. Upload image to R2 if we have one
      let receiptUrl: string | undefined;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/assets/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error ?? "upload failed");
        }
        const uploadData = await uploadRes.json();
        receiptUrl = uploadData.url;
      }

      // 2. Create reimbursement timesheet entry
      const body: Record<string, unknown> = {
        entry: description.trim(),
        type: "reimbursement",
        amount: Number(amount),
        status: "draft",
        dateAndTime: { start: date },
        billable: false,
      };

      // Attach receipt URL in the explanation field
      if (receiptUrl) {
        body.explanation = `receipt: ${receiptUrl}`;
      }

      const tsRes = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!tsRes.ok) {
        const err = await tsRes.json();
        throw new Error(err.error ?? "failed to save");
      }

      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "something went wrong");
      setStep("capture");
    }
  }, [amount, description, date, file]);

  const handleCaptureAnother = useCallback(() => {
    // Reset everything
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setAmount("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setErrorMsg("");
    setStep("capture");
    if (inputRef.current) inputRef.current.value = "";
  }, [preview]);

  // ── done state ──────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="h-14 w-14 text-green-500" />
        <p className="text-sm font-medium">receipt saved</p>
        <p className="text-xs text-muted-foreground">
          submitted as draft — awaiting approval
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleCaptureAnother}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium bg-foreground text-background rounded-lg active:opacity-90"
          >
            <Plus className="h-4 w-4" />
            capture another
          </button>
          <button
            onClick={() => router.push("/m/work")}
            className="px-5 py-3 text-sm font-medium border rounded-lg active:opacity-90"
          >
            done
          </button>
        </div>
      </div>
    );
  }

  // ── saving state ────────────────────────────────────────
  if (step === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">uploading receipt...</p>
      </div>
    );
  }

  // ── capture form ────────────────────────────────────────
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">receipt</h1>

      <div className="space-y-4">
        {/* Camera / image capture */}
        {preview ? (
          <div className="relative rounded-lg overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="receipt preview"
              className="w-full max-h-56 object-cover"
            />
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-lg border-2 border-dashed border-border text-muted-foreground active:bg-muted/50 transition-colors"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm">tap to photograph receipt</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            amount ($)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-3 text-lg font-mono tabular-nums border rounded-lg bg-background"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            what&apos;s it for?
          </label>
          <input
            type="text"
            placeholder="uber to client meeting..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-3 text-base border rounded-lg bg-background"
          />
        </div>

        {/* Date */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-3 text-base border rounded-lg bg-background"
          />
        </div>

        {/* Logged by */}
        {currentUser && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>logging as</span>
            <span className="font-medium text-foreground">
              {currentUser.firstName}
            </span>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!amount || !description.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-base font-medium bg-foreground text-background rounded-lg active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          save receipt
        </button>
      </div>
    </>
  );
}
