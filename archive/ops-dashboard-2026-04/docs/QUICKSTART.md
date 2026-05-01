# quick start guide

Get the ops dashboard running in 2 minutes.

## prerequisites

- **Node.js** 18 or higher (check: `node --version`)
- **npm** 9 or higher (check: `npm --version`)

## setup (first time only)

```bash
# Navigate to the project
cd ops-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

## development workflow

### View changes in real-time

```bash
npm run dev
```

The app auto-reloads as you edit files.

### Make changes to data

All dashboard data is in `lib/data.ts`. Edit it to see changes:

```typescript
// lib/data.ts
export const projects: Project[] = [
  // Add/edit projects here
];
```

### Make changes to components

Components are in `components/`. They're reusable UI pieces:

- `ProjectCard.tsx` — Individual project card
- `TeamMemberCard.tsx` — Team member info
- `TaskCard.tsx` — Task display
- etc.

Example: Edit the ProjectCard to change how projects look.

### Make changes to styling

Global styles are in `app/globals.css`. Tailwind classes are in components.

Example: Change the dark background color in `tailwind.config.ts`:

```typescript
colors: {
  dark: {
    bg: '#0a0a0a', // Change this
  },
},
```

## building for production

```bash
# Create optimized build
npm run build

# Test production build locally
npm start
```

## file structure at a glance

```
ops-dashboard/
├── app/              ← Main page & layout
├── components/       ← Reusable UI pieces
├── lib/              ← Data & utilities
├── public/           ← Static assets (images, etc)
├── package.json      ← Dependencies
└── README.md         ← Full documentation
```

## common tasks

### Add a new project

Edit `lib/data.ts`:

```typescript
export const projects: Project[] = [
  // ... existing projects
  {
    id: 'my-new-project',
    name: 'My New Project',
    status: 'green',
    deadline: 'May 15, 2026',
    owner: 'Garrett',
    description: 'Description here',
  },
];
```

### Add a new team member

Edit `lib/data.ts`:

```typescript
export const teamMembers: TeamMember[] = [
  // ... existing members
  {
    id: 'new-person',
    name: 'New Person Name',
    role: 'Their Role',
    focus: ['Thing 1', 'Thing 2'],
  },
];
```

### Add a new task

Edit `lib/data.ts`:

```typescript
export const tasks: Task[] = [
  // ... existing tasks
  {
    id: 'new-task-id',
    title: 'Task Title',
    category: 'Project Name',
    assigned: 'Person Name',
    subtasks: ['Subtask 1', 'Subtask 2'],
  },
];
```

### Change dashboard layout

Edit `app/page.tsx`. The page uses a grid layout:

```typescript
// 1 column on mobile, 2 on tablet, 4 on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards go here */}
</div>
```

### Add a new section

1. Create new component in `components/` if needed
2. Add it to `app/page.tsx`
3. Add data to `lib/data.ts`

## debugging

### Console errors

Press `Ctrl+Shift+J` (or `Cmd+Option+J` on Mac) to open browser console.

### Next.js errors

Check the terminal where `npm run dev` is running.

### TypeScript errors

Run this to see all type errors:

```bash
npx tsc --noEmit
```

## useful commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Lint code (check for issues)
npm run lint

# Clean up node_modules and reinstall
rm -rf node_modules && npm install
```

## keyboard shortcuts

- **Ctrl+K** (or **Cmd+K** on Mac) — Open VS Code command palette
- **Ctrl+Shift+P** — Open browser console
- **Ctrl+S** — Save file (most editors)

## resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

## troubleshooting

### "Cannot find module" error

```bash
# Clear cache and reinstall
npm install
rm -rf .next
npm run dev
```

### Port 3000 already in use

```bash
# Use a different port
npm run dev -- -p 3001
```

Then visit http://localhost:3001

### Changes not showing up

1. Save the file (Ctrl+S)
2. Check the terminal for errors
3. Try refreshing the browser (Ctrl+R)
4. If still stuck, stop dev server and restart: `npm run dev`

## next steps

- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Visit http://localhost:3000
- [ ] Edit `lib/data.ts` and see changes in real-time
- [ ] Read `README.md` for full documentation
- [ ] Deploy to Vercel (`vercel deploy`)

## need help?

- Check the `README.md` for full documentation
- Check `DEPLOYMENT.md` for deployment options
- Check `NOTION_INTEGRATION.md` for Notion API setup

---

**Happy coding!**
