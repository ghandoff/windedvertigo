"use client";

/**
 * CharacterVariantProvider + useCharacterVariant — client-side context
 * for the harbour character cast's kid/adult register.
 *
 * Lives in its own file (not index.tsx) so the main CharacterSlot
 * component stays server-safe. Only consumers that want the ambient
 * register from cookie state need to opt into this file.
 *
 * Usage:
 *   // In a server-component root layout:
 *   const cookieStore = await cookies();
 *   const grownup = cookieStore.get("cw-ui-mode")?.value === "grownup";
 *   return (
 *     <CharacterVariantProvider variant={grownup ? "adult" : "kid"}>
 *       {children}
 *     </CharacterVariantProvider>
 *   );
 *
 *   // In a client component that renders CharacterSlot:
 *   const variant = useCharacterVariant();
 *   return <CharacterSlot character="cord" size={48} variant={variant} />;
 *
 * Kid is always the default. Provider wraps children; hook returns the
 * current register. Any CharacterSlot consumer that wants ambient
 * register support reads the hook and passes the result as an explicit
 * variant prop — keeps CharacterSlot itself free of React hooks.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { CharacterName } from "./index";

export type CharacterVariant = "kid" | "adult";

const CharacterVariantContext = createContext<CharacterVariant>("kid");

export interface CharacterVariantProviderProps {
  variant: CharacterVariant;
  children: ReactNode;
}

export function CharacterVariantProvider({
  variant,
  children,
}: CharacterVariantProviderProps) {
  return (
    <CharacterVariantContext.Provider value={variant}>
      {children}
    </CharacterVariantContext.Provider>
  );
}

/**
 * Read the ambient character register. Defaults to "kid" if no
 * provider wraps the tree — safe to call from any client component.
 */
export function useCharacterVariant(): CharacterVariant {
  return useContext(CharacterVariantContext);
}

/** Re-export for callers who want a single import. */
export type { CharacterName };
