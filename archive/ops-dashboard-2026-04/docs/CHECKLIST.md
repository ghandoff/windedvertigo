# deployment checklist

Use this checklist before deploying to production.

## pre-deployment

### Code Quality
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No console errors in dev: `npm run dev`
- [ ] All sections render correctly
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Dark theme looks correct
- [ ] All animations smooth

### Data Verification
- [ ] All projects updated in `lib/data.ts`
- [ ] Team members list is complete
- [ ] Meetings are accurate
- [ ] Tasks are up to date
- [ ] Financial metrics structure ready (even if placeholder)
- [ ] No hardcoded URLs or sensitive info

### Environment Setup
- [ ] `.env.local` file created (for local testing)
- [ ] No API keys in source code
- [ ] `.gitignore` includes `.env.local`
- [ ] Package.json dependencies verified

### Build Test
- [ ] `npm run build` completes without errors
- [ ] `npm start` works locally
- [ ] Page loads in < 3 seconds
- [ ] All sections visible in production build

## vercel deployment

If deploying to Vercel:

- [ ] Vercel account created (free tier works)
- [ ] GitHub repository set up (if using GitHub)
- [ ] `vercel login` authenticated
- [ ] `vercel deploy --prod` succeeds
- [ ] Environment variables added to Vercel dashboard
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate deployed

### Vercel Configuration
- [ ] Framework: Next.js
- [ ] Build command: `npm run build`
- [ ] Output directory: `.next`
- [ ] Install command: `npm install`

## self-hosted deployment

If deploying to your own server:

### Server Setup
- [ ] Server running Ubuntu/Debian
- [ ] Node.js 18+ installed
- [ ] PM2 or systemd configured
- [ ] Nginx/Apache reverse proxy set up
- [ ] SSL certificate (Let's Encrypt or paid)
- [ ] Firewall allows port 80 & 443

### Application Setup
- [ ] Code cloned from Git
- [ ] `npm install --production` completed
- [ ] `npm run build` successful
- [ ] `npm start` runs without errors
- [ ] PM2 process manager configured
- [ ] Environment variables set

### Monitoring
- [ ] PM2 monitoring enabled
- [ ] Log files configured
- [ ] Uptime monitoring set up
- [ ] Error alerts configured

## post-deployment

### Verification
- [ ] Dashboard accessible from production URL
- [ ] All sections load correctly
- [ ] Responsive design works on mobile
- [ ] Performance acceptable (< 3s load)
- [ ] No console errors in browser
- [ ] No server errors in logs

### Monitoring
- [ ] Access logs reviewed
- [ ] Error logs checked (should be empty)
- [ ] Performance metrics reviewed
- [ ] User feedback collected

### Documentation
- [ ] Deployment URL documented
- [ ] Team notified of launch
- [ ] Emergency contact info shared
- [ ] Runbook created for common issues

## future enhancements

### Next Phase (Notion Integration)
- [ ] Notion workspace set up
- [ ] API integration token created
- [ ] Database IDs collected
- [ ] `@notionhq/client` installed
- [ ] NOTION_INTEGRATION.md reviewed
- [ ] Test queries working
- [ ] Data sync tested

### Next Phase (CI/CD)
- [ ] GitHub Actions workflow created
- [ ] Automated tests added
- [ ] Deployment pipeline configured
- [ ] Status badges added to README

## rollback plan

If deployment has issues:

1. Check production logs
2. Revert to previous version: `git revert`
3. Re-deploy: `vercel deploy --prod` or restart PM2
4. Notify team of status

For Vercel, you can rollback instantly from dashboard.

## emergency contacts

- **Garrett**: garrett@windedvertigo.com
- **Payton**: (communications contact)
- **Hosting Support**: See DEPLOYMENT.md

## success criteria

- [ ] Dashboard loads in < 3 seconds
- [ ] All data sections visible
- [ ] Responsive on all devices
- [ ] No console/server errors
- [ ] Team can access it
- [ ] Performance acceptable
- [ ] Monitoring in place

## post-launch todos

- [ ] Set up automated backups
- [ ] Configure alerts for downtime
- [ ] Plan Notion API integration
- [ ] Add edit functionality for tasks
- [ ] Integrate financial data
- [ ] Set up Slack notifications
- [ ] Create runbook for operations team

---

**Last updated**: March 28, 2026
**Deployment status**: Ready for verification
**Next milestone**: Vercel deployment or self-hosted setup
