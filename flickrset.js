// flickrset.js - New Tab page script for GPlusTab extension
// Manifest V3 compatible - uses chrome.storage.local

// Escape HTML special characters properly (replaces all occurrences)
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

window.addEventListener("DOMContentLoaded", async function() {
  // Use chrome.storage.local instead of localStorage
  const result = await chrome.storage.local.get(['photoCache', 'showTitle', 'showOwner']);
  const cachedImages = result.photoCache || [];

  if (cachedImages.length === 0) {
    console.log("No cached images available yet. Please wait for background to fetch images.");
    return;
  }

  var whichImage = Math.round(Math.random() * (cachedImages.length - 1));
  var cached = cachedImages[whichImage];
  var bg = document.getElementById('bg');
  bg.style.width = window.innerWidth + 'px';
  bg.style.height = window.innerHeight + 'px';
  var img = new Image();
  img.onload = function() {
    window.onresize();
    img.style.opacity = 1;
  };
  window.onresize = function() {
    bg.style.width = window.innerWidth + 'px';
    bg.style.height = window.innerHeight + 'px';
    var f = Math.max(window.innerWidth/img.width, window.innerHeight/img.height);
    // Use standard CSS transform instead of webkitTransform
    img.style.transform = 'scale('+f+')';
    img.style.left = (window.innerWidth - img.width*f) / 2 + 'px';
    img.style.top = (window.innerHeight- img.height*f) / 2 + 'px';
  };
  img.src = cached.src;
  bg.appendChild(img);
  var tgtX = 25+Math.floor(Math.random()*3) * 25 + '%';
  var tgtY = 25+Math.floor(Math.random()*3) * 25 + '%';
  // Use standard CSS properties instead of webkit prefixed
  bg.style.transformOrigin = tgtX + ' ' + tgtY;
  bg.style.transform = 'scale(1.0)';
  var byline = document.getElementById("wrapper");
  // Use HTTPS instead of HTTP
  byline.href = 'https://www.flickr.com/photos/' + cached.owner + '/' + cached.id;
  var link = document.createElement("link");
  link.rel = "canonical";
  link.href = byline.href;
  document.head.appendChild(link);

  // Google+ integration removed - no longer calling gapi.plusone.go()

  if (result.showTitle) {
    var title = document.createElement("span");
    title.setAttribute("class", "title");
    if (cached.title) {
      // Use escapeHtml function which properly replaces all occurrences
      var escapedTitle = escapeHtml(cached.title);
      title.innerHTML = escapedTitle + " by ";
    }
    else {
      title.innerHTML = "by ";
    }
    byline.appendChild(title);
    if (result.showOwner) {
      var owner = document.createElement("span");
      owner.setAttribute("class", "owner");
      // Use escapeHtml function which properly replaces all occurrences
      var escapedOwnername = escapeHtml(cached.ownername);
      owner.innerHTML = escapedOwnername;
      byline.appendChild(owner);
    }
  }
  else {
    byline.innerHTML = "View in photostream";
  }
  window.onbeforeunload = function() {
    document.body.onmousemove = null;
  }
  window.setTimeout(function() {
    var mouseX = 0;
    document.body.onmousemove = function(evt) {
      if (mouseX == 0) {
        mouseX = evt.pageX;
      }
      if (mouseX != evt.pageX) {
        byline.style.opacity = 1;
        // Google+ plusone element removed - no longer setting plusone.style.opacity
        document.body.onmousemove = null;
      }
    }
  }, 200);
}, false);
