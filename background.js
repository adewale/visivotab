// Background service worker for GPlusTab extension
// Manifest V3 compatible - uses chrome.storage.local instead of localStorage
// No DOM access (service workers don't have DOM)

const API_KEY = "451560b07336cacb930729101ba3800f";
const USER_SET = "72157627053006607";
const PER_PAGE = "500";
const shortTimeout = 500;
const longTimeout = 5 * 60 * 1000;
const DEBUG = false;

function log(o) {
  if (DEBUG) console.log(o);
}

// Initialize config options
async function initConfig() {
  const result = await chrome.storage.local.get(['useSmallerImages', 'showTitle', 'showOwner', 'photoCache']);

  // Set defaults if not already set
  const updates = {};
  if (result.useSmallerImages === undefined) updates.useSmallerImages = true;
  if (result.showTitle === undefined) updates.showTitle = true;
  if (result.showOwner === undefined) updates.showOwner = true;
  if (result.photoCache === undefined) updates.photoCache = [];

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

function fetchPool(poolId, callback) {
  const req = new XMLHttpRequest();
  req.open(
    "GET",
    "https://api.flickr.com/services/rest/?" +
      "method=flickr.groups.pools.getPhotos&" +
      "api_key=" + API_KEY + "&" +
      "group_id=" + poolId + "&" +
      "extras=url_o&" +
      "per_page=" + PER_PAGE,
    true);
  req.onload = function() { callback(req) };
  req.send(null);
}

function fetchSet(photosetId, callback) {
  const req = new XMLHttpRequest();
  req.open(
    "GET",
    "https://api.flickr.com/services/rest/?" +
      "method=flickr.photosets.getPhotos&" +
      "api_key=" + API_KEY + "&" +
      "photoset_id=" + photosetId + "&" +
      "extras=url_o&" +
      "per_page=" + PER_PAGE,
    true);
  req.onload = function() { callback(req) };
  req.send(null);
}

async function fillCache(req) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(req.responseText, "text/xml");
  const photos = xmlDoc.getElementsByTagName("photo");
  log("adding photos");

  // Initialize empty cache
  await chrome.storage.local.set({ photoCache: [] });

  // Start adding photos
  async function againAndAgain() {
    const result = await chrome.storage.local.get(['photoCache', 'useSmallerImages']);
    const photoCache = result.photoCache || [];

    await addOnePhoto(photos, result.useSmallerImages);

    if (photoCache.length < 30) {
      setTimeout(againAndAgain, shortTimeout);
    } else {
      await removeOnePhoto();
      setTimeout(againAndAgain, longTimeout);
    }
  }

  againAndAgain();
}

async function addOnePhoto(aPhotos, useSmallerImages) {
  const whichPhoto = Math.round(Math.random() * (aPhotos.length - 1));
  const photo = aPhotos[whichPhoto];
  log("adding photo");

  // Construct image URL without DOM preloading
  // Service workers don't have DOM, so we just store the URL
  let imgSrc;
  if (useSmallerImages && parseInt(photo.getAttribute("width_o")) > 1280) {
    imgSrc = constructImageUrl(photo);
  } else if (photo.getAttribute("url_o") == null || photo.getAttribute("url_o") == "") {
    imgSrc = constructImageUrl(photo);
  } else {
    imgSrc = photo.getAttribute("url_o");
  }

  const result = await chrome.storage.local.get(['photoCache']);
  const photoCache = result.photoCache || [];

  const cached = {
    src: imgSrc,
    title: photo.getAttribute("title"),
    id: photo.getAttribute("id"),
    ownername: "Adewale Oshineye",
    owner: "adewale_oshineye"
  };

  photoCache.push(cached);
  await chrome.storage.local.set({ photoCache: photoCache });
}

async function removeOnePhoto() {
  const result = await chrome.storage.local.get(['photoCache']);
  const photoCache = result.photoCache || [];
  photoCache.shift();
  await chrome.storage.local.set({ photoCache: photoCache });
}

// See: https://www.flickr.com/services/api/misc.urls.html
function constructImageUrl(photo) {
  return "https://farm" + photo.getAttribute("farm") +
      ".staticflickr.com/" + photo.getAttribute("server") +
      "/" + photo.getAttribute("id") +
      "_" + photo.getAttribute("secret") +
      "_b.jpg";
}

// Initialize and start fetching
initConfig().then(() => {
  fetchSet(USER_SET, fillCache);
});
