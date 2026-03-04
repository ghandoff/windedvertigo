import type { PackId } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    userId: string;
    packs: PackId[];
    hasFullDeck: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    packs?: PackId[];
    hasFullDeck?: boolean;
    refreshedAt?: number;
  }
}
