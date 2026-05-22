// Background service worker for GPlusTab extension
// Manifest V3 compatible - uses chrome.alarms, chrome.storage

import {
  fetchPhotoset,
  buildInitialCache,
  refreshCache
} from './src/photo-cache.js';

const API_KEY = "451560b07336cacb930729101ba3800f";
const USER_SET = "72157627053006607";
const ALARM_NAME = "refreshPhotoCache";
const CACHE_TARGET_SIZE = 30;
const REFRESH_INTERVAL_MINUTES = 5;

// Storage adapter for chrome.storage.local
const storage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items)
};

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
    await refreshCache(storage, fetch, USER_SET, API_KEY, CACHE_TARGET_SIZE);
  }
}

async function scheduleRefresh() {
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });
}

async function initConfig() {
  try {
    const result = await storage.get(['useSmallerImages', 'showTitle', 'showOwner', 'photoCache']);
    const updates = {};
    if (result.useSmallerImages === undefined) updates.useSmallerImages = true;
    if (result.showTitle === undefined) updates.showTitle = true;
    if (result.showOwner === undefined) updates.showOwner = true;
    if (result.photoCache === undefined) updates.photoCache = [];

    if (Object.keys(updates).length > 0) {
      await storage.set(updates);
    }
  } catch (error) {
    console.error("Failed to initialize config:", error);
  }
}

async function fetchAndCachePhotos() {
  try {
    const photos = await fetchPhotoset(USER_SET, API_KEY, fetch);
    if (photos && photos.length > 0) {
      await buildInitialCache(photos, storage, CACHE_TARGET_SIZE);
    }
  } catch (error) {
    console.error("Failed to fetch and cache photos:", error);
  }
}
