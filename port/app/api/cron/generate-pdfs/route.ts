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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

function getPdfR2Client(): S3Client {
  // Support both CF_ACCOUNT_ID (port convention) and R2_ACCOUNT_ID (site convention)
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured — set R2_ACCOUNT_ID (or CF_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadPdfBuffer(
  r2: S3Client,
  key: string,
  body: Uint8Array,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: PDF_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
    }),
  );
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
