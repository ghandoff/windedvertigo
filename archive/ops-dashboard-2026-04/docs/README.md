# winded.vertigo ops dashboard

Command center & second brain dashboard for winded.vertigo LLC.

## overview

This is a Next.js 14+ ops dashboard that provides a unified view of project health, financial metrics, team pulse, upcoming meetings, dispatch tasks, and action items.

## tech stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Theme**: Dark mode (near-black #0a0a0a with subtle borders)

## features

- **Project Health**: Monitor active projects with status badges, deadlines, and ownership
- **Financial Snapshot**: Revenue pipeline, burn rate, cash position, outstanding invoices (placeholder structure)
- **Team Pulse**: Grid view of team members with their roles and current focus areas
- **Upcoming**: 7-day view of meetings and critical deadlines
- **Dispatch Status**: Status of automated tasks (weekly-cfo-review, invoice-processor)
- **Action Items**: Open tasks organized by category with subtasks and ownership
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Subtle Animations**: Card fade-in effects on page load

## project structure

```
ops-dashboard/
├── app/
│   ├── globals.css        # Global styles and animations
│   ├── layout.tsx         # Root layout with metadata
│   └── page.tsx           # Main dashboard page
├── components/            # Reusable UI components
│   ├── ProjectCard.tsx
│   ├── FinancialMetricCard.tsx
│   ├── TeamMemberCard.tsx
│   ├── MeetingCard.tsx
│   ├── TaskCard.tsx
│   ├── DispatchCard.tsx
│   └── SectionHeader.tsx
├── lib/
│   └── data.ts           # Dashboard data configuration
├── public/               # Static assets (favicons, etc.)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
└── .gitignore
```

## getting started

### Installation

```bash
cd ops-dashboard
npm install
```

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## data structure

All dashboard data is currently stored in `lib/data.ts` and can be easily replaced with Notion API calls. The data includes:

- **Projects**: Name, status (green/yellow/red), deadline, owner, description
- **Team Members**: Name, role, current focus areas
- **Meetings**: Title, day, time, timezone, attendees
- **Tasks**: Title, category, assigned owner, subtasks
- **Dispatch Tasks**: Schedule, last run, status
- **Financial Metrics**: Structure with placeholder "awaiting data" states

### Adding Data from Notion API

To integrate with Notion, replace the exports in `lib/data.ts` with API calls:

```typescript
async function fetchProjectsFromNotion() {
  // Notion API integration
}
```

## styling

### Color Palette

- **Background**: `#0a0a0a` (near-black)
- **Cards**: `#121212` (slightly lighter)
- **Borders**: `#222222` (subtle)
- **Text**: `#e0e0e0` (light gray)
- **Muted Text**: `#888888` (medium gray)

### Status Badge Colors

- **Green** (active): emerald-950 background, emerald-300 text
- **Yellow** (in progress): yellow-950 background, yellow-300 text
- **Red** (blocked): red-950 background, red-300 text

### Animations

Cards fade in with a staggered delay effect on page load. No heavy animations — designed for clarity and quick scanning.

## responsive design

- **Mobile** (< 640px): Single column layout
- **Tablet** (640px - 1024px): 2-column grid
- **Desktop** (> 1024px): 3-4 column grids depending on section

## brand voice

All text uses lowercase aesthetic matching winded.vertigo brand identity. UI text is minimal and functional.

## future enhancements

- Notion API integration for real-time data
- User authentication
- Edit/update capabilities for tasks and projects
- Calendar integration
- Real-time financial data from accounting system
- Slack notifications for status changes
- Dark/light theme toggle
- Export reports

## deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

Create a `.env.local` file for local development:

```
NEXT_PUBLIC_APP_ENV=development
```

For production, set environment variables in your deployment platform.

## license

Proprietary — winded.vertigo LLC

---

**powered by cowork dispatch**
