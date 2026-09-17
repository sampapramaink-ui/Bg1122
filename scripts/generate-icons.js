import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const svgPath = path.join(publicDir, 'icon.svg');
  const maskableSvgPath = path.join(publicDir, 'icon-maskable.svg');

  console.log('Generating PWA icons from SVG...');

  // 1. 192x192 PNG
  await sharp(svgPath)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✅ pwa-192x192.png generated');

  // 2. 512x512 PNG
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✅ pwa-512x512.png generated');

  // 3. Maskable 512x512 PNG
  await sharp(maskableSvgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✅ pwa-maskable-512x512.png generated');

  // 4. Apple Touch Icon 180x180 PNG
  await sharp(svgPath)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✅ apple-touch-icon.png generated');

  // 5. Favicon PNG
  await sharp(svgPath)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✅ favicon.ico generated');

  console.log('🎉 All BETGURU PWA icons successfully generated!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
