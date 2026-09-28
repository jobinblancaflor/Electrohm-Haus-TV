const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../src/app');
const config = getDefaultConfig(projectRoot);

// The web app's framework-free catalog code lives outside this project: let Metro watch it and
// resolve "@shared/..." imports to it.
config.watchFolders = [sharedRoot];
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName.startsWith('@shared/')) {
    return resolve(context, path.join(sharedRoot, moduleName.slice('@shared/'.length)), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
