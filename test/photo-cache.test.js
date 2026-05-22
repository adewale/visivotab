import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  constructImageUrl,
  createCachedPhoto,
  fetchPhotoset,
  buildInitialCache,
  refreshCache
} from '../src/photo-cache.js';
import {
  buildPhoto,
  buildLargePhoto,
  buildPhotoWithoutOriginal,
  buildCachedPhoto,
  buildMockStorage,
  resetBuilders
} from './builders.js';
import { flickrPhotosetResponse, flickrErrorResponse, flickrEmptyResponse } from './fixtures/flickr-api.js';

beforeEach(() => {
  resetBuilders();
});

describe('constructImageUrl', () => {
  it('constructs a valid Flickr static URL with all required parts', () => {
    const photo = { farm: 1, server: '123', id: '456', secret: 'abc' };

    const url = constructImageUrl(photo);

    // Verify URL structure (3+ assertions)
    expect(url).toMatch(/^https:\/\/farm\d+\.staticflickr\.com\//);
    expect(url).toContain('/123/');  // server
    expect(url).toContain('/456_');  // id
    expect(url).toContain('_abc_');  // secret
    expect(url).toMatch(/_b\.jpg$/); // size suffix
  });

  // Property-based: URL construction is deterministic
  it('always produces the same URL for the same input (deterministic)', () => {
    fc.assert(
      fc.property(
        fc.record({
          farm: fc.integer({ min: 1, max: 10 }),
          server: fc.stringMatching(/^\d{3,4}$/),
          id: fc.stringMatching(/^\d{5,12}$/),
          secret: fc.stringMatching(/^[a-f0-9]{10}$/)
        }),
        (photo) => {
          const url1 = constructImageUrl(photo);
          const url2 = constructImageUrl(photo);
          return url1 === url2;
        }
      )
    );
  });

  // Property-based: URL always contains all input components
  it('URL contains all photo metadata components', () => {
    fc.assert(
      fc.property(
        fc.record({
          farm: fc.integer({ min: 1, max: 10 }),
          server: fc.stringMatching(/^\d{3}$/),
          id: fc.stringMatching(/^\d{6}$/),
          secret: fc.stringMatching(/^[a-f0-9]{8}$/)
        }),
        (photo) => {
          const url = constructImageUrl(photo);
          return (
            url.includes(`farm${photo.farm}`) &&
            url.includes(`/${photo.server}/`) &&
            url.includes(`/${photo.id}_`) &&
            url.includes(`_${photo.secret}_`)
          );
        }
      )
    );
  });

  it('handles numeric and string farm values identically', () => {
    const numericFarm = constructImageUrl({ farm: 7, server: '100', id: '1', secret: 'x' });
    const stringFarm = constructImageUrl({ farm: '7', server: '100', id: '1', secret: 'x' });

    expect(numericFarm).toBe(stringFarm);
    expect(numericFarm).toContain('farm7');
  });
});

describe('createCachedPhoto', () => {
  it('creates a complete cached photo object with all required fields', () => {
    const photo = buildPhoto({ title: 'Test Title' });

    const cached = createCachedPhoto(photo, true);

    // Verify all required fields exist and have correct types
    expect(cached).toHaveProperty('src');
    expect(cached).toHaveProperty('title', 'Test Title');
    expect(cached).toHaveProperty('id', photo.id);
    expect(cached).toHaveProperty('ownername', 'Adewale Oshineye');
    expect(cached).toHaveProperty('owner', 'adewale_oshineye');
    expect(typeof cached.src).toBe('string');
    expect(cached.src).toMatch(/^https?:\/\//);
  });

  describe('image size optimization', () => {
    it('uses original URL when width <= 1280 and useSmallerImages is true', () => {
      const photo = buildPhoto({ width_o: '1280', url_o: 'https://original.jpg' });

      const cached = createCachedPhoto(photo, true);

      expect(cached.src).toBe('https://original.jpg');
    });

    it('uses constructed URL when width > 1280 and useSmallerImages is true', () => {
      const photo = buildLargePhoto({ width_o: '1281' });

      const cached = createCachedPhoto(photo, true);

      expect(cached.src).toContain('staticflickr.com');
      expect(cached.src).not.toBe(photo.url_o);
    });

    it('uses original URL regardless of size when useSmallerImages is false', () => {
      const photo = buildLargePhoto({ url_o: 'https://huge-original.jpg' });

      const cached = createCachedPhoto(photo, false);

      expect(cached.src).toBe('https://huge-original.jpg');
    });

    // Boundary: exactly at threshold
    it('uses original at exactly 1280px width', () => {
      const photo = buildPhoto({ width_o: '1280' });
      expect(createCachedPhoto(photo, true).src).toBe(photo.url_o);
    });

    // Boundary: just over threshold
    it('uses constructed at 1281px width', () => {
      const photo = buildPhoto({ width_o: '1281' });
      expect(createCachedPhoto(photo, true).src).toContain('staticflickr.com');
    });
  });

  describe('missing original URL handling', () => {
    it('falls back to constructed URL when url_o is null', () => {
      const photo = buildPhotoWithoutOriginal();
      photo.url_o = null;

      const cached = createCachedPhoto(photo, false);

      expect(cached.src).toContain('staticflickr.com');
      expect(cached.src).toContain(photo.id);
    });

    it('falls back to constructed URL when url_o is empty string', () => {
      const photo = buildPhoto({ url_o: '' });

      const cached = createCachedPhoto(photo, false);

      expect(cached.src).toContain('staticflickr.com');
    });

    it('falls back to constructed URL when url_o is undefined', () => {
      const photo = buildPhotoWithoutOriginal();

      const cached = createCachedPhoto(photo, false);

      expect(cached.src).toContain('staticflickr.com');
    });
  });

  // Property: width_o parsing handles various formats
  it('handles width_o as string or number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        (width) => {
          const photoWithString = buildPhoto({ width_o: String(width) });
          const photoWithNumber = buildPhoto({ width_o: width });

          const cached1 = createCachedPhoto(photoWithString, true);
          const cached2 = createCachedPhoto(photoWithNumber, true);

          // Both should make the same decision about using original vs constructed
          const usedOriginal1 = cached1.src === photoWithString.url_o;
          const usedOriginal2 = cached2.src === photoWithNumber.url_o;
          return usedOriginal1 === usedOriginal2;
        }
      )
    );
  });
});

describe('fetchPhotoset', () => {
  it('fetches and parses a real Flickr API response structure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(flickrPhotosetResponse)
    });

    const photos = await fetchPhotoset('72157627053006607', 'API_KEY', mockFetch);

    // Verify against real API structure
    expect(photos).toHaveLength(3);
    expect(photos[0]).toHaveProperty('id', '5934560785');
    expect(photos[0]).toHaveProperty('secret');
    expect(photos[0]).toHaveProperty('server');
    expect(photos[0]).toHaveProperty('farm');
    expect(photos[0]).toHaveProperty('title', 'Sunset over the city');
  });

  it('constructs correct API URL with all required parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(flickrPhotosetResponse)
    });

    await fetchPhotoset('12345', 'MY_API_KEY', mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('https://api.flickr.com/services/rest/');
    expect(calledUrl).toContain('method=flickr.photosets.getPhotos');
    expect(calledUrl).toContain('photoset_id=12345');
    expect(calledUrl).toContain('api_key=MY_API_KEY');
    expect(calledUrl).toContain('format=json');
    expect(calledUrl).toContain('nojsoncallback=1');
    expect(calledUrl).toContain('extras=url_o,width_o');
  });

  describe('error handling', () => {
    it('throws descriptive error on HTTP failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      await expect(fetchPhotoset('123', 'KEY', mockFetch))
        .rejects.toThrow('Flickr API error: 503');
    });

    it('throws on Flickr API error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(flickrErrorResponse)
      });

      await expect(fetchPhotoset('123', 'KEY', mockFetch))
        .rejects.toThrow('Flickr API returned: fail');
    });

    it('returns empty array for empty photoset (not an error)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(flickrEmptyResponse)
      });

      const photos = await fetchPhotoset('123', 'KEY', mockFetch);

      expect(photos).toEqual([]);
      expect(Array.isArray(photos)).toBe(true);
    });
  });
});

describe('buildInitialCache', () => {
  it('populates cache with correct structure from API photos', async () => {
    const storage = buildMockStorage({ useSmallerImages: true });
    const photos = flickrPhotosetResponse.photoset.photo;

    await buildInitialCache(photos, storage, 30);

    const cached = storage._getData().photoCache;
    expect(cached).toHaveLength(3);

    // Verify each cached photo has required structure
    for (const photo of cached) {
      expect(photo).toHaveProperty('id');
      expect(photo).toHaveProperty('src');
      expect(photo).toHaveProperty('title');
      expect(photo).toHaveProperty('ownername');
      expect(photo).toHaveProperty('owner');
      expect(photo.src).toMatch(/^https:\/\//);
    }
  });

  it('respects targetSize limit', async () => {
    const storage = buildMockStorage({ useSmallerImages: true });
    const photos = Array.from({ length: 10 }, () => buildPhoto());

    await buildInitialCache(photos, storage, 5);

    expect(storage._getData().photoCache).toHaveLength(5);
  });

  it('shuffles photos (statistical test)', async () => {
    const storage = buildMockStorage({ useSmallerImages: true });
    const photos = Array.from({ length: 20 }, (_, i) => buildPhoto({ id: String(i) }));

    // Run multiple times and check if order varies
    const orders = [];
    for (let i = 0; i < 10; i++) {
      resetBuilders();
      const s = buildMockStorage({ useSmallerImages: true });
      await buildInitialCache([...photos], s, 20);
      orders.push(s._getData().photoCache.map(p => p.id).join(','));
    }

    // At least some runs should produce different orders
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBeGreaterThan(1);
  });

  // Boundary: empty input
  it('handles empty photos array', async () => {
    const storage = buildMockStorage({ useSmallerImages: true });

    await buildInitialCache([], storage, 30);

    expect(storage._getData().photoCache).toEqual([]);
  });

  // Boundary: targetSize of 0
  it('handles targetSize of 0', async () => {
    const storage = buildMockStorage({ useSmallerImages: true });
    const photos = [buildPhoto()];

    await buildInitialCache(photos, storage, 0);

    expect(storage._getData().photoCache).toEqual([]);
  });
});

describe('refreshCache', () => {
  it('rotates cache correctly when at capacity', async () => {
    const existingCache = [
      buildCachedPhoto({ id: 'old1' }),
      buildCachedPhoto({ id: 'old2' }),
      buildCachedPhoto({ id: 'old3' })
    ];

    const storage = buildMockStorage({
      photoCache: existingCache,
      useSmallerImages: true
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(flickrPhotosetResponse)
    });

    await refreshCache(storage, mockFetch, '123', 'KEY', 3);

    const newCache = storage._getData().photoCache;
    expect(newCache).toHaveLength(3);
    expect(newCache[0].id).toBe('old2'); // old1 removed (FIFO)
    expect(newCache[1].id).toBe('old3');
    // newCache[2] is the new photo
    expect(['5934560785', '5934561234', '5934562345']).toContain(newCache[2].id);
  });

  it('adds without removing when under capacity', async () => {
    const existingCache = [buildCachedPhoto({ id: 'existing' })];
    const storage = buildMockStorage({
      photoCache: existingCache,
      useSmallerImages: true
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(flickrPhotosetResponse)
    });

    await refreshCache(storage, mockFetch, '123', 'KEY', 10);

    const newCache = storage._getData().photoCache;
    expect(newCache).toHaveLength(2);
    expect(newCache[0].id).toBe('existing'); // kept
  });

  describe('error resilience', () => {
    it('does not modify cache on HTTP error', async () => {
      const existingCache = [buildCachedPhoto({ id: 'preserved' })];
      const storage = buildMockStorage({
        photoCache: [...existingCache],
        useSmallerImages: true
      });

      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await refreshCache(storage, mockFetch, '123', 'KEY', 30);

      // Cache unchanged
      expect(storage._getData().photoCache).toEqual(existingCache);
    });

    it('does not modify cache when API returns empty', async () => {
      const existingCache = [buildCachedPhoto({ id: 'preserved' })];
      const storage = buildMockStorage({
        photoCache: [...existingCache],
        useSmallerImages: true
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(flickrEmptyResponse)
      });

      await refreshCache(storage, mockFetch, '123', 'KEY', 30);

      expect(storage._getData().photoCache).toEqual(existingCache);
    });

    it('does not throw on network failure', async () => {
      const storage = buildMockStorage({ photoCache: [], useSmallerImages: true });
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(refreshCache(storage, mockFetch, '123', 'KEY', 30))
        .resolves.toBeUndefined();
    });
  });
});
