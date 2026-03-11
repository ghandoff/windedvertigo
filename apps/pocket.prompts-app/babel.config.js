module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router babel plugin must be added explicitly in a monorepo.
      // babel-preset-expo checks hasModule('expo-router') using require.resolve
      // from its own location (hoisted to monorepo root), but expo-router is
      // installed locally in this app — so the auto-detection fails silently.
      require('babel-preset-expo/build/expo-router-plugin').expoRouterBabelPlugin,
    ],
  };
};
