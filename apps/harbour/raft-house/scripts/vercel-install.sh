#!/bin/bash
# Vercel install script for subdirectory deploys.
#
# Problem: Vercel uploads only the app subdirectory, so workspace
# packages (@windedvertigo/*) can't be resolved by npm install.
#
# Solution: Strip workspace deps before npm install, then copy the
# actual package sources into node_modules. Also patch CSS imports
# that use workspace package paths or relative monorepo paths.

set -e

# 1. Remove all @windedvertigo/* workspace deps from package.json
node -e "
  const p = require('./package.json');
  for (const key of Object.keys(p.dependencies || {})) {
    if (key.startsWith('@windedvertigo/')) delete p.dependencies[key];
  }
  require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2));
"

# 2. Install public dependencies
npm install

# 2.5. Install peer deps required by workspace stubs (not in raft-house's own package.json)
npm install @vercel/postgres stripe --save=false 2>/dev/null || true

# 3. Copy workspace package snapshots into node_modules
if [ -d "scripts/workspace-stubs" ]; then
  mkdir -p node_modules/@windedvertigo
  cp -r scripts/workspace-stubs/@windedvertigo/* node_modules/@windedvertigo/
fi
# 4. Patch globals.css — inline tokens CSS and fix monorepo references
node -e "
  const fs = require('fs');
  let css = fs.readFileSync('./app/globals.css', 'utf8');
  // inline the tokens CSS directly (replace @import with file contents)
  const tokensPath = './node_modules/@windedvertigo/tokens/index.css';
  if (fs.existsSync(tokensPath)) {
    const tokensCss = fs.readFileSync(tokensPath, 'utf8');
    css = css.replace(
      /@import ['\"]@windedvertigo\/tokens\/index\.css['\"];?\n?/,
      tokensCss + '\n'
    );
  }
  // remove @source directives pointing outside the app directory
  css = css.replace(/@source\s+['\"]\.\.\/\.\.\/.+['\"];?\n?/g, '');
  fs.writeFileSync('./app/globals.css', css);
"
