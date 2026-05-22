import { describe, it, expect, vi } from 'vitest';
import {
  escapeHtml,
  selectRandomPhoto,
  calculateImageTransform,
  buildFlickrPhotoUrl,
  pickRandomTransformOrigin
} from '../src/newtab.js';

describe('escapeHtml', () => {
  it('returns empty string for null input', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('A < B')).toBe('A &lt; B');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('A > B')).toBe('A &gt; B');
  });

  it('escapes all occurrences, not just the first', () => {
    expect(escapeHtml('A & B & C')).toBe('A &amp; B &amp; C');
  });

  it('escapes multiple different characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
  });

  it('handles text with no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('selectRandomPhoto', () => {
  it('returns a photo from the array', () => {
    const photos = [
      { id: '1', src: 'a.jpg' },
      { id: '2', src: 'b.jpg' },
      { id: '3', src: 'c.jpg' }
    ];

    const selected = selectRandomPhoto(photos);

    expect(photos).toContainEqual(selected);
  });

  it('returns the only photo when array has one element', () => {
    const photos = [{ id: '1', src: 'a.jpg' }];

    const selected = selectRandomPhoto(photos);

    expect(selected).toEqual(photos[0]);
  });

  it('returns null for empty array', () => {
    expect(selectRandomPhoto([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(selectRandomPhoto(null)).toBeNull();
  });
});

describe('calculateImageTransform', () => {
  it('scales image to cover window when image is smaller', () => {
    const result = calculateImageTransform({
      imgWidth: 800,
      imgHeight: 600,
      windowWidth: 1600,
      windowHeight: 1200
    });

    expect(result.scale).toBe(2);
    expect(result.left).toBe(0);
    expect(result.top).toBe(0);
  });

  it('scales image to cover window when image is larger', () => {
    const result = calculateImageTransform({
      imgWidth: 1600,
      imgHeight: 1200,
      windowWidth: 800,
      windowHeight: 600
    });

    expect(result.scale).toBe(0.5);
  });

  it('handles landscape window with portrait image', () => {
    const result = calculateImageTransform({
      imgWidth: 600,
      imgHeight: 800,
      windowWidth: 1200,
      windowHeight: 600
    });

    // Window aspect: 2:1, Image aspect: 3:4
    // Scale by width: 1200/600 = 2, gives height 1600 (covers 600)
    // Scale by height: 600/800 = 0.75, gives width 450 (doesn't cover 1200)
    // Should use scale 2
    expect(result.scale).toBe(2);
  });

  it('centers the image horizontally and vertically', () => {
    const result = calculateImageTransform({
      imgWidth: 1000,
      imgHeight: 500,
      windowWidth: 800,
      windowHeight: 600
    });

    // Scale = max(800/1000, 600/500) = max(0.8, 1.2) = 1.2
    // Scaled width = 1000 * 1.2 = 1200
    // Scaled height = 500 * 1.2 = 600
    // Left = (800 - 1200) / 2 = -200
    // Top = (600 - 600) / 2 = 0
    expect(result.scale).toBe(1.2);
    expect(result.left).toBe(-200);
    expect(result.top).toBe(0);
  });
});

describe('buildFlickrPhotoUrl', () => {
  it('builds correct Flickr photo URL', () => {
    const url = buildFlickrPhotoUrl('john_doe', '12345');

    expect(url).toBe('https://www.flickr.com/photos/john_doe/12345');
  });

  it('handles owner with underscores', () => {
    const url = buildFlickrPhotoUrl('adewale_oshineye', '67890');

    expect(url).toBe('https://www.flickr.com/photos/adewale_oshineye/67890');
  });
});

describe('pickRandomTransformOrigin', () => {
  it('returns a valid CSS transform-origin value', () => {
    const origin = pickRandomTransformOrigin();

    // Should be "X% Y%" format where X and Y are 25, 50, or 75
    expect(origin).toMatch(/^(25|50|75)% (25|50|75)%$/);
  });

  it('returns different values over multiple calls (statistical)', () => {
    const origins = new Set();
    for (let i = 0; i < 50; i++) {
      origins.add(pickRandomTransformOrigin());
    }

    // With 9 possible combinations, 50 calls should produce at least 2 different values
    expect(origins.size).toBeGreaterThan(1);
  });
});
