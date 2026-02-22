import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId: string;
    orgId: string | null;
    orgName: string | null;
    orgRole: string | null;
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    orgId: string | null;
    orgName: string | null;
    orgRole: string | null;
    isAdmin: boolean;
  }
}
