# deployment guide

## quick start

### Prerequisites

- Node.js 18+ and npm
- Git (for version control)

### Local Setup

```bash
cd ops-dashboard
npm install
npm run dev
```

Visit `http://localhost:3000`

## deployment options

### Option 1: Vercel (Recommended)

Vercel is the company behind Next.js and provides the smoothest deployment experience.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

The dashboard will be live at your Vercel URL.

### Option 2: Self-hosted (Ubuntu/Linux Server)

1. **SSH into your server**

```bash
ssh user@your-server.com
cd /apps
git clone <your-repo-url>
cd ops-dashboard
```

2. **Install dependencies**

```bash
npm install --production
npm run build
```

3. **Set up PM2 for process management**

```bash
npm install -g pm2

pm2 start npm --name "ops-dashboard" -- start
pm2 startup
pm2 save
```

4. **Configure Nginx as reverse proxy**

Create `/etc/nginx/sites-available/ops-dashboard`:

```nginx
server {
  listen 80;
  server_name ops.windedvertigo.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ops-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. **Set up SSL with Let's Encrypt**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ops.windedvertigo.com
```

### Option 3: Docker + Cloudflare

1. **Create Dockerfile** (already provided in README)

2. **Build Docker image**

```bash
docker build -t ops-dashboard .
```

3. **Run container**

```bash
docker run -p 3000:3000 -d ops-dashboard
```

4. **Point Cloudflare DNS to your server**

In Cloudflare dashboard, create an A record pointing to your server's IP.

## environment variables

Create `.env.production.local` for production:

```
NEXT_PUBLIC_APP_ENV=production
# Add Notion API key when ready
NOTION_API_KEY=<your-key>
```

Do NOT commit environment variables to git. Use your deployment platform's secrets manager.

## monitoring

### Vercel

Vercel provides built-in analytics:
- Visit `vercel.com/dashboard` to see deployments, analytics, and logs

### Self-hosted

Use PM2 Plus for monitoring:

```bash
pm2 plus  # Set up free monitoring account
pm2 link <secret_key> <public_key>
```

## ci/cd pipeline

### GitHub Actions (if using GitHub)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## updates & maintenance

### Updating dependencies

```bash
npm update
npm run build
# Test locally before deploying
npm run dev
```

### Zero-downtime deployments

Both Vercel and PM2 handle zero-downtime deployments automatically.

## troubleshooting

### Port 3000 already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Memory issues on low-resource servers

Increase Node.js memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm start
```

### Slow builds

Check build time with:

```bash
npm run build -- --debug
```

## backup & recovery

### Database backup (when using Notion API)

Notion handles backup automatically. No additional action needed.

### Code backup

Ensure code is backed up in git:

```bash
git push origin main
```

## monitoring checklist

- [ ] Dashboard loads without errors
- [ ] All cards display correctly
- [ ] No console errors in browser DevTools
- [ ] Responsive on mobile (320px), tablet (768px), desktop (1920px)
- [ ] Page load time < 2 seconds
- [ ] CPU usage stable
- [ ] Memory usage stable (< 500MB)

## support

For deployment issues:
- Check Vercel/server logs
- Review Next.js documentation: https://nextjs.org/docs
- Check Tailwind CSS docs: https://tailwindcss.com/docs

---

Last updated: March 28, 2026
