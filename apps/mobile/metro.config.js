const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Expo monorepo 标准配置:apps/mobile 为项目根,zhouerfuqi 为 workspace 根
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
