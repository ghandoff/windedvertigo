"use client";

import { useState, useEffect, useCallback } from "react";
import type { PackId } from "./types";
import { getEntitlements, grantAccess, hasFullDeck, getSessionId } from "./access";

export function useAccess() {
  const [entitlements, setEntitlements] = useState<PackId[]>(["sampler"]);

  useEffect(() => {
    setEntitlements(getEntitlements());
  }, []);

  const grant = useCallback((pack: PackId, sessionId?: string) => {
    grantAccess(pack, sessionId);
    setEntitlements(getEntitlements());
  }, []);

  return {
    entitlements,
    hasFullDeck: entitlements.includes("full"),
    isSamplerOnly: !entitlements.includes("full"),
    sessionId: getSessionId(),
    grant,
  };
}
