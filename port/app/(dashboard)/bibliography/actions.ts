"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  insertBibliographyRow,
  updateBibliographyRow,
  deleteBibliographyRow,
  getBibliographyRowById,
} from "@/lib/supabase/bibliography";
import { retrievePdf, resolveFullTextUrl } from "@/lib/bibliography/scholar/pdf-retrieval";
import { uploadAsset } from "@/lib/r2/upload";
import {
  parseReferences,
  planImport,
  applyImport,
  parseInTextCitations,
  planInText,
  applyInText,
  findSimilar,
  type ImportPlan,
  type InTextPlan,
} from "@/lib/bibliography/import";
import { fetchByDoi, metaToHit, type CrossrefMeta } from "@/lib/bibliography/crossref";
import { searchScholar } from "@/lib/bibliography/scholar";
import type { ScholarHit, ProviderStat } from "@/lib/bibliography/scholar/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function addCitationAction(input: {
  fullCitation: string;
  topic?: string;
  sourceType?: string;
  year?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
  usedIn?: string[];
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    if (!input.fullCitation?.trim()) return { error: "a full citation is required" };
    const similar = await findSimilar(input.fullCitation);
    if (similar) return { error: "a matching citation is already in the bibliography" };
    const res = await insertBibliographyRow({
      fullCitation: input.fullCitation.trim(),
      topic: input.topic?.trim() || undefined,
      sourceType: input.sourceType?.trim() || undefined,
      year: input.year ?? null,
      doi: input.doi?.trim() || null,
      abstract: input.abstract?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      usedIn: input.usedIn ?? [],
    });
    if (!res.created) return { error: res.reason === "duplicate" ? "that citation is already in the bibliography" : "couldn't add it" };
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Set the full used_in (assets) list for an entry. */
export async function updateUsedInAction(
  id: string,
  usedIn: string[],
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updateBibliographyRow(id, { usedIn });
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateCitationAction(
  id: string,
  fields: {
    fullCitation?: string;
    topic?: string | null;
    sourceType?: string | null;
    year?: number | null;
    doi?: string | null;
    abstract?: string | null;
    notes?: string | null;
    usedIn?: string[];
  },
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updateBibliographyRow(id, fields);
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse a pasted reference list + plan how it maps onto the bibliography.
 * Never writes — returns the review plan (matched / new / already-tagged).
 */
export async function parseImportAction(
  text: string,
  asset: string,
): Promise<{ plan?: ImportPlan; error?: string }> {
  await requireSession();
  try {
    if (!text?.trim()) return { error: "paste a reference list first" };
    if (!asset?.trim()) return { error: "choose or name an asset to tag" };
    const parsed = await parseReferences(text);
    if (parsed.length === 0) return { error: "no citations found in that text" };
    const plan = await planImport(parsed, asset.trim());
    return { plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse a document's IN-TEXT citations + plan which library rows they tag.
 * Never writes — returns the review plan (matched / already-tagged / unresolved).
 */
export async function parseInTextAction(
  text: string,
  asset: string,
): Promise<{ plan?: InTextPlan; error?: string }> {
  await requireSession();
  try {
    if (!text?.trim()) return { error: "paste the text first" };
    if (!asset?.trim()) return { error: "choose or name an asset to tag" };
    const parsed = await parseInTextCitations(text);
    if (parsed.length === 0) return { error: "no in-text citations found in that text" };
    const plan = await planInText(parsed, asset.trim());
    return { plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Apply a reviewed in-text plan: tag matched rows. Inserts nothing. */
export async function applyInTextAction(
  plan: InTextPlan,
): Promise<{ tagged?: number; error?: string }> {
  await requireSession();
  try {
    const res = await applyInText(plan);
    revalidatePath("/bibliography");
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Apply a reviewed import plan: tag matched rows + insert new citations. */
export async function applyImportAction(
  plan: ImportPlan,
): Promise<{ tagged?: number; inserted?: number; error?: string }> {
  await requireSession();
  try {
    const res = await applyImport(plan);
    revalidatePath("/bibliography");
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Look up Crossref metadata for a DOI (auto-fill the add/edit form). No write. */
export async function fetchDoiMetadataAction(
  doi: string,
): Promise<{ meta?: CrossrefMeta; error?: string }> {
  await requireSession();
  try {
    if (!doi?.trim()) return { error: "enter a DOI first" };
    const meta = await fetchByDoi(doi);
    if (!meta) return { error: "no Crossref record for that DOI" };
    return { meta };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Smart find: if the input contains a DOI, resolve the exact paper (Crossref);
 * otherwise run the federated search across all providers. No write.
 */
export async function searchScholarlyAction(
  query: string,
): Promise<{ hits?: ScholarHit[]; providers?: ProviderStat[]; exact?: boolean; error?: string }> {
  await requireSession();
  try {
    if (!query?.trim()) return { error: "enter a search query" };
    const doi = query.match(/10\.\d{4,9}\/[^\s"<>]+/);
    if (doi) {
      const meta = await fetchByDoi(doi[0]);
      if (meta) return { hits: [metaToHit(meta)], providers: [{ id: "crossref", count: 1 }], exact: true };
      // DOI didn't resolve — fall through to a free-text search of the raw input
    }
    const { hits, providers } = await searchScholar(query);
    return { hits, providers };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resolve a working full-text URL for a search hit via the OA waterfall —
 * WITHOUT downloading bytes. Lets the search results offer "read full text"
 * up front, independent of saving. Returns null when no open-access copy exists.
 */
export async function resolveFullTextAction(input: {
  doi?: string | null;
  openAccessPdf?: string | null;
  arxivId?: string | null;
  pmid?: string | null;
}): Promise<{ url: string; source: string } | null> {
  await requireSession();
  try {
    return await resolveFullTextUrl({
      doi: input.doi ?? null,
      oaUrl: input.openAccessPdf ?? null,
      arxivId: input.arxivId ?? null,
      pmid: input.pmid ?? null,
    });
  } catch {
    return null;
  }
}

/** Add a federated search result to the bibliography (dedupes on citation_key). */
export async function addFromSearchAction(
  hit: ScholarHit,
  usedIn: string[] = [],
): Promise<{ ok?: true; error?: string; reason?: string; id?: string }> {
  await requireSession();
  try {
    const fullCitation = hit?.fullCitation?.trim();
    if (!fullCitation) return { error: "nothing to add" };
    // fuzzy guard — provider formatting differs from our stored APA, so the exact
    // citation_key dedupe would miss same-work duplicates.
    const similar = await findSimilar(fullCitation);
    if (similar) return { error: "already in the library", reason: "duplicate" };
    const doiUrl = hit.doi ? `https://doi.org/${hit.doi}` : hit.url || null;
    const res = await insertBibliographyRow({
      fullCitation,
      year: hit.year ?? null,
      doi: doiUrl,
      sourceType: hit.sourceType ?? undefined,
      abstract: hit.abstract ?? undefined,
      publisherLink: doiUrl,
      // stash the OA PDF link so PDF retrieval has a first, reliable tier
      scholarLink: hit.openAccessPdf ?? null,
      citationCount: hit.citationCount ?? null,
      usedIn,
      // structured fields — power the author sort + journal facet + clean title
      authors: hit.authors?.length ? hit.authors : null,
      firstAuthor: hit.authors?.[0] ?? null,
      journal: hit.venue ?? null,
      title: hit.title || null,
    });
    if (!res.created) {
      return { error: res.reason === "duplicate" ? "already in the library" : "couldn't add it", reason: res.reason };
    }
    revalidatePath("/bibliography");
    return { ok: true, id: res.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Retrieve an open-access PDF for a citation and store it in R2. Best-effort:
 * runs the waterfall over the row's OA link + DOI, and on a hit uploads to
 * `bibliography-pdfs/<id>.pdf` and sets pdf_url (the serve path) + pdf_source.
 */
export async function retrievePdfAction(
  id: string,
): Promise<{ ok?: true; source?: string; error?: string }> {
  await requireSession();
  try {
    const row = await getBibliographyRowById(id);
    if (!row) return { error: "citation not found" };
    if (row.pdfUrl) return { ok: true, source: row.pdfSource ?? "stored" };
    const arxivId = row.scholarLink?.includes("arxiv.org")
      ? row.scholarLink.match(/(\d{4}\.\d{4,5})(v\d+)?/)?.[0] ?? null
      : null;
    const found = await retrievePdf({ doi: row.doi, oaUrl: row.scholarLink, arxivId });
    if (!found) return { error: "no open-access PDF found" };
    const key = `bibliography-pdfs/${id}.pdf`;
    await uploadAsset(Buffer.from(found.bytes), key, "application/pdf");
    await updateBibliographyRow(id, { pdfUrl: `/api/bibliography/${id}/pdf`, pdfSource: found.source });
    revalidatePath("/bibliography");
    return { ok: true, source: found.source };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCitationAction(id: string): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await deleteBibliographyRow(id);
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
