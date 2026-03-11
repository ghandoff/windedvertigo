// metro.config.js — monorepo-aware Metro config for Expo
// watches the workspace root's node_modules in addition to the local ones

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const project_root = __dirname;
const monorepo_root = path.resolve(project_root, '../..');

const config = getDefaultConfig(project_root);

// 1. set the project root explicitly (critical for monorepo)
config.projectRoot = project_root;

// 2. watch the monorepo root for hoisted packages
config.watchFolders = [monorepo_root];

// 3. resolve modules from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(project_root, 'node_modules'),
  path.resolve(monorepo_root, 'node_modules'),
];

// 4. disable package exports resolution to avoid monorepo conflicts
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
