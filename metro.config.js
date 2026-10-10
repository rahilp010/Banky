const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    // Minify in production builds
    minifierConfig: {
      output: {
        comments: false,
      },
    },
  },
  // Limit workers to avoid memory issues
  maxWorkers: 2,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
