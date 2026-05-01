"use client";

import { createContext, useContext } from "react";

interface UserInfo {
  email: string;
  name: string;
  firstName: string;
}

const UserContext = createContext<UserInfo | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: UserInfo | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): UserInfo | null {
  return useContext(UserContext);
}
