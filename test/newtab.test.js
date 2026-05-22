import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  escapeHtml,
  selectRandomPhoto,
  calculateImageTransform,
  buildFlickrPhotoUrl,
  pickRandomTransformOrigin
} from '../src/newtab.js';
import { buildCachedPhoto, resetBuilders } from './builders.js';

describe('escapeHtml', () => {
  describe('null/empty handling', () => {
    it('returns empty string for null', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('character escaping', () => {
    it('escapes all HTML-sensitive characters', () => {
      const input = '<script>alert("XSS & attack")</script>';
      const output = escapeHtml(input);

      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
      expect(output).toContain('&amp;');
    });

    it('escapes ALL occurrences, not just first', () => {
      const input = '<a><b><c>';
      const output = escapeHtml(input);

      expect(output).toBe('&lt;a&gt;&lt;b&gt;&lt;c&gt;');
      expect((output.match(/&lt;/g) || []).length).toBe(3);
      expect((output.match(/&gt;/g) || []).length).toBe(3);
    });
  });

  // Property: escaping is idempotent after first application
  it('double-escaping produces different output (not idempotent)', () => {
    const input = '<test>';
    const once = escapeHtml(input);
    const twice = escapeHtml(once);

    // &lt; becomes &amp;lt; on second pass
    expect(twice).not.toBe(once);
    expect(twice).toContain('&amp;lt;');
  });

  // Property: safe strings pass through unchanged
  it('leaves safe strings unchanged', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 .,!?-]*$/),
        (safeString) => {
          return escapeHtml(safeString) === safeString;
        }
      )
    );
  });

  // Property: output never contains unescaped dangerous chars
  it('output never contains raw < or > characters', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const output = escapeHtml(input);
          return !output.includes('<') && !output.includes('>');
        }
      )
    );
  });

  // Property: escaping preserves string length or increases it
  it('escaped string is never shorter than input', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const output = escapeHtml(input);
          return output.length >= (input?.length || 0);
        }
      )
    );
  });
});

describe('selectRandomPhoto', () => {
  beforeEach(() => resetBuilders());

  describe('edge cases', () => {
    it('returns null for null input', () => {
      expect(selectRandomPhoto(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(selectRandomPhoto(undefined)).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(selectRandomPhoto([])).toBeNull();
    });
  });

  it('returns the only element for single-element array', () => {
    const photo = buildCachedPhoto();
    const selected = selectRandomPhoto([photo]);

    expect(selected).toBe(photo); // Same reference
    expect(selected.id).toBe(photo.id);
  });

  it('always returns an element from the input array', () => {
    const photos = [buildCachedPhoto(), buildCachedPhoto(), buildCachedPhoto()];

    for (let i = 0; i < 100; i++) {
      const selected = selectRandomPhoto(photos);
      expect(photos).toContain(selected);
    }
  });

  // Property: selection is uniform (statistical)
  it('selects from entire array over many iterations', () => {
    const photos = Array.from({ length: 5 }, () => buildCachedPhoto());
    const selections = new Map();

    for (let i = 0; i < 500; i++) {
      const selected = selectRandomPhoto(photos);
      selections.set(selected.id, (selections.get(selected.id) || 0) + 1);
    }

    // Each photo should be selected at least once in 500 tries
    expect(selections.size).toBe(5);
    for (const count of selections.values()) {
      expect(count).toBeGreaterThan(10); // Statistically likely
    }
  });
});

describe('calculateImageTransform', () => {
  describe('cover behavior (always fills window)', () => {
    it('scales up small image to cover window', () => {
      const result = calculateImageTransform({
        imgWidth: 100,
        imgHeight: 100,
        windowWidth: 200,
        windowHeight: 200
      });

      expect(result.scale).toBe(2);
      expect(result.left).toBe(0);
      expect(result.top).toBe(0);
    });

    it('scales down large image to cover window', () => {
      const result = calculateImageTransform({
        imgWidth: 1000,
        imgHeight: 1000,
        windowWidth: 500,
        windowHeight: 500
      });

      expect(result.scale).toBe(0.5);
    });

    // Property: scaled image always covers window
    it('scaled image always covers entire window', () => {
      fc.assert(
        fc.property(
          fc.record({
            imgWidth: fc.integer({ min: 100, max: 5000 }),
            imgHeight: fc.integer({ min: 100, max: 5000 }),
            windowWidth: fc.integer({ min: 100, max: 3000 }),
            windowHeight: fc.integer({ min: 100, max: 2000 })
          }),
          (dims) => {
            const result = calculateImageTransform(dims);
            const scaledWidth = dims.imgWidth * result.scale;
            const scaledHeight = dims.imgHeight * result.scale;

            // Scaled image must be >= window in both dimensions
            return (
              scaledWidth >= dims.windowWidth - 0.001 &&
              scaledHeight >= dims.windowHeight - 0.001
            );
          }
        )
      );
    });
  });

  describe('centering behavior', () => {
    it('centers image when aspect ratios match', () => {
      const result = calculateImageTransform({
        imgWidth: 800,
        imgHeight: 600,
        windowWidth: 800,
        windowHeight: 600
      });

      expect(result.scale).toBe(1);
      expect(result.left).toBe(0);
      expect(result.top).toBe(0);
    });

    it('centers horizontally for wide image in narrow window', () => {
      const result = calculateImageTransform({
        imgWidth: 1000,
        imgHeight: 500,
        windowWidth: 800,
        windowHeight: 600
      });

      // Scale = 1.2 (to cover height)
      // Scaled width = 1200, left = (800 - 1200) / 2 = -200
      expect(result.left).toBe(-200);
      expect(result.top).toBe(0);
    });

    it('centers vertically for tall image in wide window', () => {
      const result = calculateImageTransform({
        imgWidth: 500,
        imgHeight: 1000,
        windowWidth: 800,
        windowHeight: 600
      });

      // Scale = 1.6 (to cover width)
      // Scaled height = 1600, top = (600 - 1600) / 2 = -500
      expect(result.scale).toBe(1.6);
      expect(result.left).toBe(0);
      expect(result.top).toBe(-500);
    });

    // Property: image is always centered
    it('image center aligns with window center', () => {
      fc.assert(
        fc.property(
          fc.record({
            imgWidth: fc.integer({ min: 100, max: 5000 }),
            imgHeight: fc.integer({ min: 100, max: 5000 }),
            windowWidth: fc.integer({ min: 100, max: 3000 }),
            windowHeight: fc.integer({ min: 100, max: 2000 })
          }),
          (dims) => {
            const result = calculateImageTransform(dims);
            const scaledWidth = dims.imgWidth * result.scale;
            const scaledHeight = dims.imgHeight * result.scale;

            // Image center should equal window center
            const imgCenterX = result.left + scaledWidth / 2;
            const imgCenterY = result.top + scaledHeight / 2;
            const winCenterX = dims.windowWidth / 2;
            const winCenterY = dims.windowHeight / 2;

            return (
              Math.abs(imgCenterX - winCenterX) < 0.01 &&
              Math.abs(imgCenterY - winCenterY) < 0.01
            );
          }
        )
      );
    });
  });

  describe('boundary values', () => {
    it('handles very small dimensions', () => {
      const result = calculateImageTransform({
        imgWidth: 1,
        imgHeight: 1,
        windowWidth: 1920,
        windowHeight: 1080
      });

      expect(result.scale).toBe(1920);
      expect(Number.isFinite(result.left)).toBe(true);
      expect(Number.isFinite(result.top)).toBe(true);
    });

    it('handles equal dimensions', () => {
      const result = calculateImageTransform({
        imgWidth: 500,
        imgHeight: 500,
        windowWidth: 500,
        windowHeight: 500
      });

      expect(result.scale).toBe(1);
      expect(result.left).toBe(0);
      expect(result.top).toBe(0);
    });
  });
});

describe('buildFlickrPhotoUrl', () => {
  it('constructs correct URL structure', () => {
    const url = buildFlickrPhotoUrl('user123', 'photo456');

    expect(url).toBe('https://www.flickr.com/photos/user123/photo456');
    expect(url).toMatch(/^https:\/\/www\.flickr\.com\/photos\//);
  });

  it('handles special characters in owner name', () => {
    const url = buildFlickrPhotoUrl('adewale_oshineye', '12345');

    expect(url).toContain('adewale_oshineye');
    expect(url).toBe('https://www.flickr.com/photos/adewale_oshineye/12345');
  });

  // Property: URL always has correct structure
  it('always produces valid Flickr URL structure', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9_]+$/),
          fc.stringMatching(/^\d+$/)
        ),
        ([owner, photoId]) => {
          const url = buildFlickrPhotoUrl(owner, photoId);
          return (
            url.startsWith('https://www.flickr.com/photos/') &&
            url.includes(owner) &&
            url.includes(photoId)
          );
        }
      )
    );
  });
});

describe('pickRandomTransformOrigin', () => {
  it('returns valid CSS transform-origin value', () => {
    const origin = pickRandomTransformOrigin();

    expect(origin).toMatch(/^(25|50|75)% (25|50|75)%$/);
  });

  // Exhaustive: all 9 possible values can be generated
  it('can generate all 9 possible combinations', () => {
    const allOrigins = new Set();
    const expectedOrigins = [
      '25% 25%', '25% 50%', '25% 75%',
      '50% 25%', '50% 50%', '50% 75%',
      '75% 25%', '75% 50%', '75% 75%'
    ];

    // Run many times to collect all possibilities
    for (let i = 0; i < 1000; i++) {
      allOrigins.add(pickRandomTransformOrigin());
    }

    expect(allOrigins.size).toBe(9);
    for (const expected of expectedOrigins) {
      expect(allOrigins.has(expected)).toBe(true);
    }
  });

  // Property: output always matches expected format
  it('output always matches expected format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // ignored, just for iterations
        () => {
          const origin = pickRandomTransformOrigin();
          return /^(25|50|75)% (25|50|75)%$/.test(origin);
        }
      ),
      { numRuns: 100 }
    );
  });
});
