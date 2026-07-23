/**
 * GET /api/cron/generate-pdfs
 *
 * Generates branded PDF packages for each quadrant and uploads to R2.
 * Previously this route proxied to the site's /api/generate-pdfs endpoint,
 * but that endpoint was removed when the site migrated to Cloudflare Pages
 * (which cannot run @react-pdf/renderer). The PDF generation now lives here,
 * in the port (Vercel / Node.js).
 *
 * Schedule: Monday 6am UTC (port/vercel.json)
 * Requires env vars: CRON_SECRET, NOTION_TOKEN, R2_ACCOUNT_ID (or CF_ACCOUNT_ID),
 *                    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *                    R2_BUCKET_NAME (defaults to creaseworks-evidence),
 *                    R2_PUBLIC_URL
 */

import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { AwsClient } from "aws4fetch";
import { fetchPackageBuilderData } from "@/lib/notion/package-builder";
import { PackagePDF } from "@/lib/pdf/package-template";

// ── Auth ──────────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

// ── R2 helpers (creaseworks-evidence bucket) ──────────────

const PDF_BUCKET = process.env.R2_BUCKET_NAME ?? "creaseworks-evidence";
const PDF_PUBLIC_URL =
  process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ??
  "https://pub-c685a810f5794314a106e0f249c740c9.r2.dev";

// aws4fetch, not @aws-sdk/client-s3 — @aws-sdk/client-s3's default runtime
// config resolves ~10 settings (credential chain, retry mode, checksum
// config, dualstack/FIPS flags, ...) via loadConfig(), which falls back to
// fs.readFile against ~/.aws/config whenever no explicit value/env var is
// set. fs.readFile is unimplemented in the Workers nodejs_compat polyfill,
// so any S3Client request throws inside wv-port (same bug as lib/r2/client.ts;
// see site/lib/r2.ts PRs #382/#384). aws4fetch is a ~10KB SigV4 signer built
// on fetch + Web Crypto with no Node dependencies, so none of this applies.
function getPdfR2Client(): { client: AwsClient; endpoint: string } {
  // Support both CF_ACCOUNT_ID (port convention) and R2_ACCOUNT_ID (site convention)
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured — set R2_ACCOUNT_ID (or CF_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }

  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

async function uploadPdfBuffer(
  r2: { client: AwsClient; endpoint: string },
  key: string,
  body: Uint8Array,
): Promise<void> {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const res = await r2.client.fetch(`${r2.endpoint}/${PDF_BUCKET}/${encodedKey}`, {
    method: "PUT",
    // TS's DOM lib types Uint8Array as generic over ArrayBufferLike, which
    // isn't structurally assignable to BodyInit — but it's a valid fetch body.
    body: body as BodyInit,
    headers: { "content-type": "application/pdf" },
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed for ${key}: HTTP ${res.status}`);
  }
}

// ── Handler ───────────────────────────────────────────────

export const maxDuration = 120; // Notion search + 4 PDF renders + 4 R2 uploads

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const r2 = getPdfR2Client();
    const packs = await fetchPackageBuilderData();
    const results: { quadrant: string; key: string; url: string; bytes: number }[] = [];

    for (const [quadrantKey, pack] of Object.entries(packs)) {
      const buffer = await renderToBuffer(
        React.createElement(PackagePDF, { pack, quadrantKey }) as React.ReactElement<DocumentProps>,
      );

      const r2Key = `package-pdfs/${quadrantKey}.pdf`;
      await uploadPdfBuffer(r2, r2Key, new Uint8Array(buffer));

      results.push({
        quadrant: quadrantKey,
        key: r2Key,
        url: `${PDF_PUBLIC_URL}/${r2Key}`,
        bytes: buffer.byteLength,
      });
    }

    console.log("[cron/generate-pdfs] completed", JSON.stringify({ generated: results.length }));
    return NextResponse.json({
      ok: true,
      generated: results.length,
      pdfs: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/generate-pdfs] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
