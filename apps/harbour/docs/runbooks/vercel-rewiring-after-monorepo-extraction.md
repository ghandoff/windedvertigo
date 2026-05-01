# Monorepo Extraction: Vercel Project Rewiring

## Overview
When extracting apps from a monorepo into separate repositories, Vercel projects remain wired to the old monorepo with Root Directory paths that no longer exist. This causes cascading deploy failures on every commit to the source monorepo. This runbook walks through disconnecting old repos and reconnecting to new ones.

**Affected Projects (Last Incident):**
- tidal-pool
- raft-house
- mirror-log
- depth-chart
- vertigo-vault
- harbour
- wv-crm

---

## Pre-Extraction Checklist

Complete this before starting rewiring:

1. **Inventory all Vercel projects** by source repo:
   - SSH into the infrastructure or use Vercel dashboard
   - List all projects pointing to `ghandoff/windedvertigo` and standalone repos
   - For each project, note:
     - Project name and ID
     - Organization ID (Vercel org)
     - Current Root Directory setting
     - Build Command
     - Output Directory
     - Environment variables

2. **Verify new repos exist and are accessible:**
   - Confirm `ghandoff/harbour-apps` exists with apps under `apps/<app-name>/`
   - Confirm standalone repos like `ghandoff/wv-crm` exist
   - Verify team has GitHub access to all repos

3. **Identify stale monorepo references:**
   - Check for workspace flags in Build Commands: `-w crm`, `-w raft-house`, etc.
   - Look for hardcoded paths in Output Directories: `crm/dist`, `raft/build`, etc.
   - Review environment variables referencing old directory structure

---

## Execution: Rewire Each Project

### Step 1: Access Vercel Project Settings
1. Log into Vercel dashboard
2. Select the Organization containing the project
3. Open the project (e.g., **tidal-pool**)
4. Navigate to **Settings** → **Git** (left sidebar)

### Step 2: Disconnect Old Repository
1. Under "Connected Repository," locate the old repo (`ghandoff/windedvertigo`)
2. Click **Disconnect**
3. A confirmation modal appears: "This will stop deployments from this repo."
4. Click **Continue** to confirm

### Step 3: Connect New Repository
1. Click **GitHub** (the GitHub icon/button to add a new repo)
2. The GitHub repo picker opens
3. Search for or find the new repository:
   - For harbour-apps projects: `ghandoff/harbour-apps`
   - For standalone repos: `ghandoff/wv-crm`, `ghandoff/wv-ops`, etc.
4. Click **Connect** next to the correct repo

### Step 4: Update Build Settings
1. Navigate to **Settings** → **Build & Deployment** (same sidebar)
2. Verify and update these fields:

   **Root Directory:**
   - Old: `/crm` (at monorepo root)
   - New: `apps/harbour` (if under harbour-apps) or `.` (if standalone)
   
   **Build Command:**
   - Check for monorepo workspace flags: `-w crm`, `-w harbour`
   - Remove workspace flags if the project is now standalone
   - Example:
     - Old: `npm run build -w crm`
     - New: `npm run build` (or `npm run build --prefix=apps/harbour` if still in monorepo)

   **Output Directory:**
   - Remove monorepo-specific paths
   - Old: `crm/dist`, `raft-house/build`
   - New: `dist`, `build`

   **Ignored Build Step:**
   - Remove paths from old monorepo structure
   - Check that ignore patterns still match the new repo layout

3. Save changes

### Step 5: Verify Environment Variables
1. Navigate to **Settings** → **Environment Variables**
2. Search for variables containing old directory references:
   - `NEXT_PUBLIC_MONOREPO_PATH`
   - `BUILD_STEP_ROOT`
   - Any custom vars with hardcoded paths
3. Update or remove stale references
4. Save changes

---

## Post-Extraction Verification

### Immediate Verification
1. In **Deployments** view, click the most recent deployment
2. Check the **Build Logs** for:
   - Correct Root Directory being used (should not show `not found` errors)
   - Build commands executing in the right path
   - No references to old monorepo structure
3. If the build fails:
   - Check error messages for missing files or paths
   - Review Root Directory and Build Command settings again
   - Look for forgotten workspace flags or hardcoded paths

### Test Deploy
1. Make a test commit to the new repo (e.g., update a README)
2. Push to the main branch
3. Monitor **Deployments** tab for the new build
4. Confirm:
   - Build starts within 30 seconds of push
   - Build completes successfully (green checkmark)
   - No deploy-failure notification emails

### Integration Check
1. If the project has custom deploy hooks (webhooks, Slack notifications), verify they still trigger
2. Check that environment variable substitutions work correctly (no undefined values)
3. Visit the deployed site and smoke-test key functionality

---

## Gotchas

**Build Commands with Workspace Flags:**
- Monorepo builds often use `-w <workspace>` or `--filter=<workspace>` flags
- These must be removed or updated for standalone builds
- Example: `pnpm build -w @harbour/raft-house` → `pnpm build`

**Output Directories with Subpaths:**
- Monorepo projects may have Output Directory like `apps/harbour/dist`
- Standalone repos should use just `dist` or `build`
- Vercel will look for this path relative to the Root Directory

**Ignored Build Step Paths:**
- Old patterns like `crm/**` will not match new structure
- Update ignore rules to match new repo layout

**Deploy Hooks:**
- Check for deploy hooks that reference old repo structure
- Some third-party integrations may cache old project references

**Environment Variables:**
- Private env vars sometimes contain monorepo paths
- Review and clean up before testing

---

## Rollback Strategy

If rewiring breaks a critical project deployment:

1. **Revert to old repo (temporary):**
   - Go to **Settings** → **Git**
   - Click **GitHub** and reconnect to `ghandoff/windedvertigo`
   - Set Root Directory back to original path (e.g., `/crm`)
   - Save and trigger a test deployment

2. **Investigate the new repo connection:**
   - Pull the new repo locally
   - Verify the app folder structure matches the Root Directory setting
   - Test build command locally: `npm run build` from the Root Directory
   - Check for missing dependencies or configuration files

3. **Reattempt rewiring:**
   - Disconnect old repo again
   - Reconnect to new repo
   - Verify all settings match local test build
   - Deploy and monitor logs

---

## Verification Checklist

- [ ] All projects inventoried pre-extraction
- [ ] Old repos disconnected from all affected projects
- [ ] New repos connected with correct Root Directory
- [ ] Build Commands updated (no stale workspace flags)
- [ ] Output Directories corrected (no monorepo subpaths)
- [ ] Environment variables reviewed and cleaned
- [ ] Ignored Build Step patterns updated
- [ ] Test deployment triggered and verified
- [ ] No deploy-failure emails received for 24 hours
- [ ] Smoke tests passed on deployed sites
- [ ] Team notified of completion

