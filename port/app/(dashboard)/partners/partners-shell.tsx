"use client";

import { useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddPartnerForm } from "./add-partner-form";

export function PartnersShell() {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <PageHeader
        title="teaming partners"
        description="local and international partners for consortium bids — NDAs, TAs, and capability profiles."
      >
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          add partner
        </Button>
      </PageHeader>

      {showForm && (
        <AddPartnerForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
