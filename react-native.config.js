const path = require('path');

module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  dependencies: {
    'react-native-sqlite-storage': {
      platforms: {
        ios: null,
        android: {
          sourceDir: path.join(__dirname, 'node_modules/react-native-sqlite-storage/platforms/android'),
          packageImportPath: 'import org.pgsqlite.SQLitePluginPackage;',
          packageInstance: 'new SQLitePluginPackage()',
        },
      },
    },
  },
};
