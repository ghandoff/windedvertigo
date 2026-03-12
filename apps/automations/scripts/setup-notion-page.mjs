#!/usr/bin/env node
/**
 * Creates a "Weekly Summaries" page in Notion and outputs the page ID.
 * Run: node scripts/setup-notion-page.mjs
 */

import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function main() {
  // Search for an existing "Weekly Summaries" page
  console.log('Searching for existing Weekly Summaries page...');
  const search = await notion.search({
    query: 'Weekly Summaries',
    filter: { property: 'object', value: 'page' },
    page_size: 5
  });

  const existing = search.results.find(p =>
    p.properties?.title?.title?.[0]?.plain_text === 'Weekly Summaries'
  );

  if (existing) {
    console.log('\nFound existing page!');
    console.log(`Page ID: ${existing.id.replace(/-/g, '')}`);
    console.log(`URL: ${existing.url}`);
    console.log('\nRun this to add the env var:');
    console.log(`npx vercel env add NOTION_WEEKLY_SUMMARIES_PAGE_ID`);
    console.log(`Value: ${existing.id.replace(/-/g, '')}`);
    return;
  }

  // Find a workspace page to be the parent
  console.log('No existing page found. Searching for a parent page...');
  const pages = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 10
  });

  // Find a top-level page (one without a parent page)
  let parentId = null;
  for (const page of pages.results) {
    if (page.parent?.type === 'workspace') {
      parentId = page.id;
      console.log(`Using "${page.properties?.title?.title?.[0]?.plain_text || 'Untitled'}" as parent`);
      break;
    }
  }

  if (!parentId && pages.results.length > 0) {
    parentId = pages.results[0].id;
    console.log('Using first available page as parent');
  }

  if (!parentId) {
    console.error('No pages found in workspace. Please create a page manually in Notion.');
    process.exit(1);
  }

  // Create the Weekly Summaries page
  console.log('Creating Weekly Summaries page...');
  const newPage = await notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: 'Weekly Summaries' } }]
      }
    },
    children: [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: 'Automated weekly summaries from the automations cron job.' }
          }]
        }
      }
    ]
  });

  const pageId = newPage.id.replace(/-/g, '');
  console.log('\nCreated page!');
  console.log(`Page ID: ${pageId}`);
  console.log(`URL: ${newPage.url}`);
  console.log('\nRun this to add the env var:');
  console.log(`npx vercel env add NOTION_WEEKLY_SUMMARIES_PAGE_ID`);
  console.log(`Value: ${pageId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
