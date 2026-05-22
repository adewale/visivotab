// Photo cache logic - testable with dependency injection
// Pure functions and functions with injected dependencies

export function constructImageUrl(photo) {
  return "https://farm" + photo.farm +
    ".staticflickr.com/" + photo.server +
    "/" + photo.id +
    "_" + photo.secret +
    "_b.jpg";
}

export function createCachedPhoto(photo, useSmallerImages) {
  let imgSrc;
  const widthO = parseInt(photo.width_o, 10);

  if (useSmallerImages && widthO > 1280) {
    imgSrc = constructImageUrl(photo);
  } else if (!photo.url_o) {
    imgSrc = constructImageUrl(photo);
  } else {
    imgSrc = photo.url_o;
  }

  return {
    src: imgSrc,
    title: photo.title,
    id: photo.id,
    ownername: "Adewale Oshineye",
    owner: "adewale_oshineye"
  };
}

export async function fetchPhotoset(photosetId, apiKey, fetchFn = fetch) {
  const url = "https://api.flickr.com/services/rest/?" +
    "method=flickr.photosets.getPhotos&" +
    "api_key=" + apiKey + "&" +
    "photoset_id=" + photosetId + "&" +
    "extras=url_o,width_o&" +
    "per_page=500&" +
    "format=json&nojsoncallback=1";

  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Flickr API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.stat !== "ok") {
    throw new Error(`Flickr API returned: ${data.stat}`);
  }

  return data.photoset?.photo || [];
}

export async function buildInitialCache(photos, storage, targetSize = 30) {
  const result = await storage.get(['useSmallerImages']);
  const useSmallerImages = result.useSmallerImages !== false;
  const photoCache = [];

  const shuffled = [...photos].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, targetSize);

  for (const photo of selected) {
    const cached = createCachedPhoto(photo, useSmallerImages);
    photoCache.push(cached);
  }

  await storage.set({ photoCache });
}

export async function refreshCache(storage, fetchFn, photosetId, apiKey, targetSize = 30) {
  try {
    const photos = await fetchPhotoset(photosetId, apiKey, fetchFn);
    if (!photos || photos.length === 0) return;

    const result = await storage.get(['photoCache', 'useSmallerImages']);
    const photoCache = result.photoCache || [];
    const useSmallerImages = result.useSmallerImages !== false;

    if (photoCache.length >= targetSize) {
      photoCache.shift();
    }

    const randomIndex = Math.floor(Math.random() * photos.length);
    const newPhoto = createCachedPhoto(photos[randomIndex], useSmallerImages);
    photoCache.push(newPhoto);

    await storage.set({ photoCache });
  } catch (error) {
    console.error("Failed to refresh cache:", error);
  }
}
