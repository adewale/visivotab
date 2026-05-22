// New tab page logic - testable pure functions

export function escapeHtml(text) {
  if (!text) return '';
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function selectRandomPhoto(photos) {
  if (!photos || photos.length === 0) return null;
  const index = Math.floor(Math.random() * photos.length);
  return photos[index];
}

export function calculateImageTransform({ imgWidth, imgHeight, windowWidth, windowHeight }) {
  const scale = Math.max(windowWidth / imgWidth, windowHeight / imgHeight);
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  const left = (windowWidth - scaledWidth) / 2;
  const top = (windowHeight - scaledHeight) / 2;

  return { scale, left, top };
}

export function buildFlickrPhotoUrl(owner, photoId) {
  return `https://www.flickr.com/photos/${owner}/${photoId}`;
}

export function pickRandomTransformOrigin() {
  const values = [25, 50, 75];
  const x = values[Math.floor(Math.random() * values.length)];
  const y = values[Math.floor(Math.random() * values.length)];
  return `${x}% ${y}%`;
}
