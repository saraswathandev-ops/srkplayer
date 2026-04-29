module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
        },
      },
    ],
    // react-native-reanimated plugin MUST be listed last
    'react-native-reanimated/plugin',
  ],
};
