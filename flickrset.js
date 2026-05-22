// flickrset.js - New Tab page script for GPlusTab extension
// Manifest V3 compatible - uses chrome.storage.local

import {
  escapeHtml,
  selectRandomPhoto,
  calculateImageTransform,
  buildFlickrPhotoUrl,
  pickRandomTransformOrigin
} from './src/newtab.js';

window.addEventListener("DOMContentLoaded", async function() {
  const result = await chrome.storage.local.get(['photoCache', 'showTitle', 'showOwner']);
  const cachedImages = result.photoCache || [];

  const cached = selectRandomPhoto(cachedImages);
  if (!cached) {
    console.log("No cached images available yet. Please wait for background to fetch images.");
    return;
  }

  const bg = document.getElementById('bg');
  bg.style.width = window.innerWidth + 'px';
  bg.style.height = window.innerHeight + 'px';

  const img = new Image();

  img.onload = function() {
    applyImageTransform();
    img.style.opacity = 1;
  };

  function applyImageTransform() {
    bg.style.width = window.innerWidth + 'px';
    bg.style.height = window.innerHeight + 'px';

    const transform = calculateImageTransform({
      imgWidth: img.width,
      imgHeight: img.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });

    img.style.transform = `scale(${transform.scale})`;
    img.style.left = transform.left + 'px';
    img.style.top = transform.top + 'px';
  }

  window.onresize = applyImageTransform;

  img.src = cached.src;
  bg.appendChild(img);

  bg.style.transformOrigin = pickRandomTransformOrigin();
  bg.style.transform = 'scale(1.0)';

  const byline = document.getElementById("wrapper");
  byline.href = buildFlickrPhotoUrl(cached.owner, cached.id);

  const link = document.createElement("link");
  link.rel = "canonical";
  link.href = byline.href;
  document.head.appendChild(link);

  if (result.showTitle) {
    const title = document.createElement("span");
    title.setAttribute("class", "title");
    title.innerHTML = cached.title ? escapeHtml(cached.title) + " by " : "by ";
    byline.appendChild(title);

    if (result.showOwner) {
      const owner = document.createElement("span");
      owner.setAttribute("class", "owner");
      owner.innerHTML = escapeHtml(cached.ownername);
      byline.appendChild(owner);
    }
  } else {
    byline.innerHTML = "View in photostream";
  }

  window.onbeforeunload = function() {
    document.body.onmousemove = null;
  };

  window.setTimeout(function() {
    let mouseX = 0;
    document.body.onmousemove = function(evt) {
      if (mouseX === 0) {
        mouseX = evt.pageX;
      }
      if (mouseX !== evt.pageX) {
        byline.style.opacity = 1;
        document.body.onmousemove = null;
      }
    };
  }, 200);
}, false);
