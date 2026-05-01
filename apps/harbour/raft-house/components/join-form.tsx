"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isValidRoomCode } from "@/lib/room-code";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const cleanCode = code.trim().toUpperCase();
      const cleanName = name.trim();

      if (!cleanCode) {
        setError("enter a room code");
        return;
      }
      if (!isValidRoomCode(cleanCode)) {
        setError("that doesn't look like a room code");
        return;
      }
      if (!cleanName) {
        setError("enter your name");
        return;
      }

      router.push(
        `/play/${cleanCode}?name=${encodeURIComponent(cleanName)}`,
      );
    },
    [code, name, router],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* room code */}
      <div>
        <label
          htmlFor="room-code"
          className="block text-xs font-medium text-[var(--rh-text-muted)] mb-1.5 text-left"
        >
          room code
        </label>
        <input
          id="room-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCDE"
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-center text-2xl font-mono tracking-[0.3em] placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
        />
      </div>

      {/* display name */}
      <div>
        <label
          htmlFor="display-name"
          className="block text-xs font-medium text-[var(--rh-text-muted)] mb-1.5 text-left"
        >
          your name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="alex"
          maxLength={30}
          autoComplete="given-name"
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-lg placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)] focus:border-transparent"
        />
      </div>

      {/* error */}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* submit */}
      <button
        type="submit"
        className="w-full py-3.5 rounded-xl bg-[var(--rh-cyan)] text-white text-lg font-semibold hover:bg-[var(--rh-teal)] transition-colors active:scale-[0.98]"
      >
        join session
      </button>
    </form>
  );
}
