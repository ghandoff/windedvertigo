"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, X } from "lucide-react";

export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isDragging = useRef(false);

  // lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    // only allow swiping left to close
    if (diff > 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateX(-${Math.min(diff, 320)}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 80) {
      setOpen(false);
    }
    if (drawerRef.current) {
      drawerRef.current.style.transform = "";
    }
  }, []);

  return (
    <>
      {/* hamburger toggle — visible on mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-card/90 backdrop-blur-sm border border-border shadow-sm md:hidden"
        aria-label="open sidebar"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* drawer panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-background border-r border-border shadow-xl overflow-y-auto transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* close button */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <span className="text-sm font-semibold text-foreground">w.v ancestry</span>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label="close sidebar"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* sidebar content */}
        <div className="p-4 space-y-6 pb-24">
          {children}
        </div>
      </div>
    </>
  );
}
