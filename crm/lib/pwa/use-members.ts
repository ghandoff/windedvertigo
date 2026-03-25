"use client";

import { useState, useEffect } from "react";

export interface MemberOption {
  id: string;
  name: string;
  firstName: string;
}

/**
 * Hook that fetches active w.v members from the API.
 * Returns first names (lowercase) for the "logged by" dropdown.
 */
export function useMembers() {
  const [members, setMembers] = useState<MemberOption[]>([]);

  useEffect(() => {
    fetch("/crm/api/members")
      .then((res) => res.json())
      .then((data) => {
        const mapped = (data.data ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => ({
            id: m.id,
            name: m.name,
            firstName: m.name.split(" ")[0].toLowerCase(),
          }),
        );
        setMembers(mapped);
      })
      .catch(() => {
        // Fallback to hardcoded if API fails
        setMembers([
          { id: "1", name: "garrett jaeger", firstName: "garrett" },
          { id: "2", name: "maría", firstName: "maría" },
          { id: "3", name: "jamie", firstName: "jamie" },
          { id: "4", name: "lamis", firstName: "lamis" },
          { id: "5", name: "yigal", firstName: "yigal" },
        ]);
      });
  }, []);

  return members;
}
