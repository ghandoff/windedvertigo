"use client";

import { createContext, useContext } from "react";
import type { AgeLevel } from "./types";

const AgeLevelContext = createContext<AgeLevel>("professional");

export function AgeLevelProvider({
  level,
  children,
}: {
  level: AgeLevel;
  children: React.ReactNode;
}) {
  return (
    <AgeLevelContext.Provider value={level}>
      {children}
    </AgeLevelContext.Provider>
  );
}

export function useAgeLevel(): AgeLevel {
  return useContext(AgeLevelContext);
}
