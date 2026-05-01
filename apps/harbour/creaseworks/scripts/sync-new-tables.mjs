import 'dotenv/config';
import { Client } from '@notionhq/client';
import { sql } from '@vercel/postgres';
import { queryDataSource } from '@windedvertigo/notion-adapter';

const notion = new Client({ auth: process.env.NOTION_TOKEN.trim() });

async function queryAll(dbId) {
  const pages = [];
  let cursor;
  do {
    const r = await queryDataSource(notion, {
      databaseId: dbId,
      pageSize: 100,
      ...(cursor !== undefined ? { startCursor: cursor } : {}),
    });
    pages.push(...r.pages);
    cursor = r.hasMore ? (r.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

// Site copy sync
const scPages = await queryAll(process.env.NOTION_DB_SITE_COPY);
for (const p of scPages) {
  const pr = p.properties;
  const key = (pr.key?.title ?? []).map(r => r.plain_text).join('').toLowerCase();
  if (!key) continue;
  const copy = pr.copy?.rich_text?.map(r => r.plain_text).join('') ?? '';
  const page = pr.page?.select?.name?.toLowerCase() ?? null;
  const section = pr.section?.select?.name?.toLowerCase() ?? null;
  const status = pr.status?.select?.name?.toLowerCase() ?? 'draft';
  const sortOrder = pr['sort order']?.number ?? 0;
  const lastEdited = p.last_edited_time;
  await sql`INSERT INTO site_copy_cache (notion_id,key,copy,page,section,status,sort_order,notion_last_edited,synced_at)
    VALUES (${p.id},${key},${copy},${page},${section},${status},${sortOrder},${lastEdited},NOW())
    ON CONFLICT (notion_id) DO UPDATE SET key=EXCLUDED.key,copy=EXCLUDED.copy,page=EXCLUDED.page,
    section=EXCLUDED.section,status=EXCLUDED.status,sort_order=EXCLUDED.sort_order,
    notion_last_edited=EXCLUDED.notion_last_edited,synced_at=NOW()`;
}
console.log('site-copy:', scPages.length, 'rows synced');

// App config sync
const acPages = await queryAll(process.env.NOTION_DB_APP_CONFIG);
for (const p of acPages) {
  const pr = p.properties;
  const name = (pr.name?.title ?? []).map(r => r.plain_text).join('').toLowerCase();
  if (!name) continue;
  const key = pr.key?.select?.name?.toLowerCase() ?? null;
  const grp = pr.group?.select?.name?.toLowerCase() ?? null;
  const sortOrder = pr['sort order']?.number ?? 0;
  const metadata = pr.metadata?.rich_text?.map(r => r.plain_text).join('') ?? null;
  const lastEdited = p.last_edited_time;
  await sql`INSERT INTO app_config_cache (notion_id,name,key,grp,sort_order,metadata,notion_last_edited,synced_at)
    VALUES (${p.id},${name},${key},${grp},${sortOrder},${metadata},${lastEdited},NOW())
    ON CONFLICT (notion_id) DO UPDATE SET name=EXCLUDED.name,key=EXCLUDED.key,grp=EXCLUDED.grp,
    sort_order=EXCLUDED.sort_order,metadata=EXCLUDED.metadata,
    notion_last_edited=EXCLUDED.notion_last_edited,synced_at=NOW()`;
}
console.log('app-config:', acPages.length, 'rows synced');

// Verify
const sc = await sql`SELECT count(*) as n FROM site_copy_cache WHERE status='live'`;
const ac = await sql`SELECT count(*) as n FROM app_config_cache`;
console.log('live site copy:', sc.rows[0].n, '| app config:', ac.rows[0].n);

process.exit(0);
