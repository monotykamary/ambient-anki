const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createIcon = (size) => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4A5568"/>
  <text x="${size/2}" y="${size/2}" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="white">A</text>
  <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.15}" fill="#48BB78" opacity="0.8"/>
</svg>`;
  return svg;
};

// Generate icons
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const svg = createIcon(size);
  const filename = path.join(__dirname, 'icons', `icon${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created ${filename}`);
});

// Note: For production, convert these SVGs to PNGs using a tool like imagemagick or an online converter
console.log('\nNote: Convert these SVG files to PNG format for the extension to use them.');