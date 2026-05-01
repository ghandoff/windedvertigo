# notion api integration guide

When ready to connect live data from Notion, follow this guide to integrate the Notion API.

## setup

### 1. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create a new integration called "ops-dashboard"
3. Copy the `Internal Integration Token` (this is your API key)

### 2. Share Notion pages with integration

For each Notion database you want to access:
1. Open the database in Notion
2. Click the "..." menu (top right)
3. Select "Connections" or "Add connections"
4. Find your integration and allow access

### 3. Get Database IDs

For each database you want to connect:
1. Open the database in Notion
2. Copy the ID from the URL: `https://notion.so/{DATABASE_ID}?v=...`

## installation

```bash
npm install @notionhq/client
```

## environment variables

Create `.env.local`:

```
NOTION_API_KEY=your_integration_token_here
NOTION_PROJECTS_DB=your_projects_database_id
NOTION_TASKS_DB=your_tasks_database_id
NOTION_TEAM_DB=your_team_members_database_id
```

## implementation

### Example: Fetch Projects

Replace the static export in `lib/data.ts`:

```typescript
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function getProjects(): Promise<Project[]> {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_PROJECTS_DB!,
  });

  return response.results
    .filter((page) => 'properties' in page)
    .map((page) => {
      const props = (page as any).properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || '',
        status: props.Status?.select?.name?.toLowerCase() || 'gray',
        deadline: props.Deadline?.date?.start || undefined,
        owner: props.Owner?.people?.[0]?.name || undefined,
        description: props.Description?.rich_text?.[0]?.plain_text || undefined,
      };
    });
}
```

### Update page.tsx for async data

Change the main page to use `async`:

```typescript
export default async function Dashboard() {
  const projectsData = await getProjects();
  const tasksData = await getTasks();
  // ... etc

  return (
    // ... dashboard JSX with dynamic data
  );
}
```

## notion database schemas

### Projects Database

| Property | Type | Purpose |
|----------|------|---------|
| Name | Title | Project name |
| Status | Select (green/yellow/red) | Current status |
| Deadline | Date | Due date |
| Owner | Person | Responsible person |
| Description | Rich text | Project details |

### Tasks Database

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | Task name |
| Category | Select | Project category |
| Assigned | Person | Task owner |
| Subtasks | Checkbox | Break down work |

### Team Members Database

| Property | Type | Purpose |
|----------|------|---------|
| Name | Title | Person's name |
| Role | Text | Job title |
| Focus | Multi-select | Current focus areas |

## caching strategy

For better performance, implement caching:

```typescript
import { cache } from 'react';

export const getProjects = cache(async () => {
  // This will memoize the request during a single render
  const response = await notion.databases.query({
    database_id: process.env.NOTION_PROJECTS_DB!,
  });
  // ... transform data
});
```

Or use Next.js revalidation:

```typescript
export const revalidate = 300; // Revalidate every 5 minutes

export default async function Dashboard() {
  const projects = await getProjects();
  // ...
}
```

## error handling

```typescript
try {
  const projects = await notion.databases.query({
    database_id: process.env.NOTION_PROJECTS_DB!,
  });
} catch (error) {
  if (error instanceof Error) {
    console.error('Notion API Error:', error.message);
    // Fall back to static data or show error UI
  }
}
```

## notion database properties reference

### Status Select Options
- **green**: Active / On track
- **yellow**: In progress / At risk
- **red**: Blocked / Off track

### Meeting Properties
- Title (title)
- Day (text)
- Time (text)
- Timezone (text)
- Attendees (multi-person)

### Financial Metrics
- Label (title)
- Value (number)
- Currency (checkbox)
- HasData (checkbox)

## notionhq client types

For TypeScript, install types:

```bash
npm install --save-dev @types/node
```

Example typed response:

```typescript
import {
  QueryDatabaseResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

export async function getProjects(): Promise<Project[]> {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_PROJECTS_DB!,
  }) as QueryDatabaseResponse;

  // Now response is fully typed
  // ...
}
```

## testing notion integration

Before deploying, test locally:

```bash
npm run dev

# Check console for errors
# Visit http://localhost:3000
# Verify all data loads from Notion
```

## notion api rate limits

- Rate limit: 3 requests per second
- Batch operations when possible
- Implement exponential backoff for retries

```typescript
async function retryNotionRequest(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === 'rate_limited' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## production checklist

- [ ] Notion API key securely stored in environment variables
- [ ] Database IDs configured in environment variables
- [ ] Error handling for failed Notion requests
- [ ] Caching strategy implemented
- [ ] Rate limits considered
- [ ] Database schemas match code expectations
- [ ] Test data migration completed
- [ ] Staging environment tested
- [ ] Production deployment tested
- [ ] Monitoring for Notion API errors set up

## useful resources

- [Notion API Documentation](https://developers.notion.com)
- [notionhq/client GitHub](https://github.com/makenotion/notion-sdk-js)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)

---

**Status**: Ready to integrate when winded.vertigo.com Notion workspace is ready
**Last updated**: March 28, 2026
