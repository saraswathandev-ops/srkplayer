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


// React Native 0.73.x uses a safe-call on Jvm.current(), which is non-null
// with the Gradle 8.11.1 / Kotlin compiler combination. The Gradle plugin
// compiles with -Werror, so this warning otherwise fails the Android build.
const reactPluginFiles = [
  path.resolve(__dirname, '../node_modules/@react-native/gradle-plugin/src/main/kotlin/com/facebook/react/ReactPlugin.kt'),
  path.resolve(__dirname, '../node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/ReactPlugin.kt'),
];

for (const reactPluginFile of reactPluginFiles) {
  if (!fs.existsSync(reactPluginFile)) continue;

  try {
    const source = fs.readFileSync(reactPluginFile, 'utf8');
    const patched = source.replace('Jvm.current()?.javaVersion', 'Jvm.current().javaVersion');

    if (patched !== source) {
      fs.writeFileSync(reactPluginFile, patched, 'utf8');
      console.log('Patched React Native Gradle plugin Kotlin warning:', reactPluginFile);
    } else if (source.includes('Jvm.current().javaVersion')) {
      console.log('React Native Gradle plugin Kotlin warning already patched.');
    } else {
      console.warn('React Native Gradle plugin source found, but expected Jvm.current() expression was not found:', reactPluginFile);
    }
  } catch (err) {
    console.warn('Could not patch React Native Gradle plugin:', err.message);
  }
}

// Gradle 8.11 emits deprecation warnings for APIs used by React Native 0.73.11
// (for example Project.exec). RNGP sets allWarningsAsErrors=true, so these
// upstream warnings fail compilation even though they are not app-code errors.
// Keep compiler warnings visible, but do not fail this dependency's build on them.
const gradlePluginBuildFiles = [
  path.resolve(__dirname, '../node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts'),
  path.resolve(__dirname, '../node_modules/@react-native/gradle-plugin/build.gradle.kts'),
];

for (const gradlePluginBuildFile of gradlePluginBuildFiles) {
  if (!fs.existsSync(gradlePluginBuildFile)) continue;

  try {
    const source = fs.readFileSync(gradlePluginBuildFile, 'utf8');
    const patched = source.replace(/allWarningsAsErrors\\s*=\\s*true/g, 'allWarningsAsErrors = false');

    if (patched !== source) {
      fs.writeFileSync(gradlePluginBuildFile, patched, 'utf8');
      console.log('Disabled warnings-as-errors for React Native Gradle plugin:', gradlePluginBuildFile);
    } else if (/allWarningsAsErrors\\s*=\\s*false/.test(source)) {
      console.log('React Native Gradle plugin warnings-as-errors already disabled.');
    } else {
      console.warn('React Native Gradle plugin build file found, but allWarningsAsErrors=true was not found:', gradlePluginBuildFile);
    }
  } catch (err) {
    console.warn('Could not patch React Native Gradle plugin build settings:', err.message);
  }
}
