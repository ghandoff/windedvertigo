"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NewContactDialog } from "@/app/components/new-contact-dialog";
import { Badge } from "@/components/ui/badge";
import { useContactsCache } from "@/lib/pwa/use-contacts-cache";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import type { CachedContact } from "@/lib/pwa/offline-store";

const STAGE_COLORS: Record<string, string> = {
  stranger: "bg-gray-100 text-gray-700",
  introduced: "bg-blue-100 text-blue-700",
  "in conversation": "bg-yellow-100 text-yellow-700",
  "warm connection": "bg-orange-100 text-orange-700",
  "active collaborator": "bg-green-100 text-green-700",
  "inner circle": "bg-purple-100 text-purple-700",
};

const WARMTH_DOT: Record<string, string> = {
  cold: "bg-blue-400",
  lukewarm: "bg-yellow-400",
  warm: "bg-orange-400",
  hot: "bg-red-500",
};

function ContactItem({ contact }: { contact: CachedContact }) {
  return (
    <div className="flex items-center gap-3 px-1 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {contact.contactWarmth && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${WARMTH_DOT[contact.contactWarmth] ?? "bg-gray-300"}`} />
          )}
          <span className="font-medium text-sm truncate">{contact.name}</span>
        </div>
        {contact.role && (
          <p className="text-xs text-muted-foreground truncate ml-4">{contact.role}</p>
        )}
      </div>
      {contact.relationshipStage && (
        <Badge variant="outline" className={`text-[10px] shrink-0 ${STAGE_COLORS[contact.relationshipStage] ?? ""}`}>
          {contact.relationshipStage}
        </Badge>
      )}
    </div>
  );
}

export default function MobileContactsPage() {
  const isOnline = useOnlineStatus();
  const { contacts, loading, search } = useContactsCache();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedContact[]>([]);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const found = await search(q);
    setResults(found);
  }

  const displayContacts = query.length >= 2 ? results : contacts.slice(0, 20);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">contacts</h1>
        <NewContactDialog compact />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isOnline ? "search contacts..." : "search cached contacts..."}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 text-base"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">loading contacts...</div>
      ) : displayContacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{query ? "no contacts match" : "no contacts cached"}</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {query ? `${displayContacts.length} results` : `${displayContacts.length} recent contacts`}
            {!isOnline && " (cached)"}
          </p>
          {displayContacts.map((c) => (
            <ContactItem key={c.id} contact={c} />
          ))}
        </div>
      )}
    </>
  );
}
