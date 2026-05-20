// Background service worker for GPlusTab extension
// Manifest V3 compatible - uses fetch(), chrome.storage, chrome.alarms

const API_KEY = "451560b07336cacb930729101ba3800f";
const USER_SET = "72157627053006607";
const PER_PAGE = "500";
const ALARM_NAME = "refreshPhotoCache";
const CACHE_TARGET_SIZE = 30;
const REFRESH_INTERVAL_MINUTES = 5;

// Register event listeners at the top level (MV3 requirement)
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.alarms.onAlarm.addListener(handleAlarm);

async function handleInstalled() {
  await initConfig();
  await fetchAndCachePhotos();
  await scheduleRefresh();
}

async function handleStartup() {
  await fetchAndCachePhotos();
  await scheduleRefresh();
}

async function handleAlarm(alarm) {
  if (alarm.name === ALARM_NAME) {
    await refreshCache();
  }
}

async function scheduleRefresh() {
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });
}

async function initConfig() {
  try {
    const result = await chrome.storage.local.get(['useSmallerImages', 'showTitle', 'showOwner', 'photoCache']);
    const updates = {};
    if (result.useSmallerImages === undefined) updates.useSmallerImages = true;
    if (result.showTitle === undefined) updates.showTitle = true;
    if (result.showOwner === undefined) updates.showOwner = true;
    if (result.photoCache === undefined) updates.photoCache = [];

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } catch (error) {
    console.error("Failed to initialize config:", error);
  }
}

async function fetchAndCachePhotos() {
  try {
    const photos = await fetchPhotoset(USER_SET);
    if (photos && photos.length > 0) {
      await buildInitialCache(photos);
    }
  } catch (error) {
    console.error("Failed to fetch and cache photos:", error);
  }
}

async function fetchPhotoset(photosetId) {
  const url = "https://api.flickr.com/services/rest/?" +
    "method=flickr.photosets.getPhotos&" +
    "api_key=" + API_KEY + "&" +
    "photoset_id=" + photosetId + "&" +
    "extras=url_o,width_o&" +
    "per_page=" + PER_PAGE + "&" +
    "format=json&nojsoncallback=1";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Flickr API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.stat !== "ok") {
    throw new Error(`Flickr API returned: ${data.stat}`);
  }

  return data.photoset?.photo || [];
}

async function buildInitialCache(photos) {
  const result = await chrome.storage.local.get(['useSmallerImages']);
  const useSmallerImages = result.useSmallerImages !== false;
  const photoCache = [];

  // Add random photos up to target size
  const shuffled = [...photos].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, CACHE_TARGET_SIZE);

  for (const photo of selected) {
    const cached = createCachedPhoto(photo, useSmallerImages);
    photoCache.push(cached);
  }

  await chrome.storage.local.set({ photoCache });
}

async function refreshCache() {
  try {
    const photos = await fetchPhotoset(USER_SET);
    if (!photos || photos.length === 0) return;

    const result = await chrome.storage.local.get(['photoCache', 'useSmallerImages']);
    const photoCache = result.photoCache || [];
    const useSmallerImages = result.useSmallerImages !== false;

    // Remove oldest photo if at capacity
    if (photoCache.length >= CACHE_TARGET_SIZE) {
      photoCache.shift();
    }

    // Add a random new photo
    const randomIndex = Math.floor(Math.random() * photos.length);
    const newPhoto = createCachedPhoto(photos[randomIndex], useSmallerImages);
    photoCache.push(newPhoto);

    await chrome.storage.local.set({ photoCache });
  } catch (error) {
    console.error("Failed to refresh cache:", error);
  }
}

function createCachedPhoto(photo, useSmallerImages) {
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

// See: https://www.flickr.com/services/api/misc.urls.html
function constructImageUrl(photo) {
  return "https://farm" + photo.farm +
    ".staticflickr.com/" + photo.server +
    "/" + photo.id +
    "_" + photo.secret +
    "_b.jpg";
}
