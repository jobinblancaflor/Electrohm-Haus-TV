const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../src/app');
const config = getDefaultConfig(projectRoot);

// The web app's framework-free catalog code lives outside this project: let Metro watch it and
// resolve "@shared/..." imports to it.
config.watchFolders = [sharedRoot];
// The shared files above also do plain `require`s of their own dependencies (e.g. Babel's
// injected runtime helpers). They live outside mobile_app/node_modules, so point Metro's module
// resolution at this project's node_modules explicitly rather than relying on upward directory
// walk from the shared files' own (nonexistent) node_modules.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName.startsWith('@shared/')) {
    return resolve(context, path.join(sharedRoot, moduleName.slice('@shared/'.length)), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
