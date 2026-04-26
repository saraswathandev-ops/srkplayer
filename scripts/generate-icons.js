// Generates all Android mipmap launcher icons from logo/srklogo.png
// Also copies a 1024x1024 version to assets/images/icon.png for Metro.
// Run: npm run generate:icons
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'logo', 'srklogo.png');
const RES  = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const SIZES = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

(async () => {
  // Metro require() source
  await sharp(SRC).resize(1024, 1024, { fit: 'cover' }).toFile(
    path.join(ROOT, 'assets', 'images', 'icon.png')
  );
  console.log('✓  assets/images/icon.png  1024x1024');

  for (const { folder, size } of SIZES) {
    const img = sharp(SRC).resize(size, size, { fit: 'cover' });
    await img.clone().toFile(path.join(RES, folder, 'ic_launcher.png'));
    await img.clone().toFile(path.join(RES, folder, 'ic_launcher_round.png'));
    console.log(`✓  ${folder}  ${size}x${size}`);
  }

  console.log('\nDone — rebuild with: npm run apk:release');
})();
