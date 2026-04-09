#!/bin/bash
# Generate simple placeholder icons using ImageMagick (if available)
if command -v convert &> /dev/null; then
  # 192x192 icon
  convert -size 192x192 xc:white \
    -fill '#4F46E5' -draw "rectangle 40,40 152,152" \
    -fill white -font DejaVu-Sans -pointsize 48 -gravity center -draw "text 0,0 'EP'" \
    pwa-192x192.png
  
  # 512x512 icon  
  convert -size 512x512 xc:white \
    -fill '#4F46E5' -draw "rectangle 100,100 412,412" \
    -fill white -font DejaVu-Sans -pointsize 120 -gravity center -draw "text 0,0 'EPUB'" \
    pwa-512x512.png
  
  echo "Icons generated with ImageMagick"
else
  # Create minimal valid PNG files as placeholders
  # 1x1 white pixel PNG (base64)
  PIXEL="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
  
  # For now, create a note that icons need to be replaced
  echo "Placeholder icons need proper PNG files." > ICONS-README.md
  echo "Please replace with actual icons: pwa-192x192.png and pwa-512x512.png" >> ICONS-README.md
  echo "" >> ICONS-README.md
  echo "For now, the PWA will use the manifest without icons until they're added." >> ICONS-README.md
  
  echo "Created ICONS-README.md - icons need to be added"
fi
