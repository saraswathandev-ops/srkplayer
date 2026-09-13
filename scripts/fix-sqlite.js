const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/react-native-sqlite-storage/react-native.config.js');

if (fs.existsSync(targetFile)) {
  try {
    let content = fs.readFileSync(targetFile, 'utf8');
    if (content.includes("project: './platforms/ios/SQLite.xcodeproj'")) {
      content = content.replace(/project:\s*'\.\/platforms\/ios\/SQLite\.xcodeproj'/, '');
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('Successfully patched react-native-sqlite-storage/react-native.config.js');
    }
  } catch (err) {
    console.warn('Could not patch react-native-sqlite-storage:', err.message);
  }
}
