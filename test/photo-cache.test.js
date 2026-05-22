import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  constructImageUrl,
  createCachedPhoto,
  fetchPhotoset,
  buildInitialCache,
  refreshCache
} from '../src/photo-cache.js';

describe('constructImageUrl', () => {
  it('constructs a Flickr static URL from photo metadata', () => {
    const photo = {
      farm: 1,
      server: '123',
      id: '456',
      secret: 'abc'
    };

    const url = constructImageUrl(photo);

    expect(url).toBe('https://farm1.staticflickr.com/123/456_abc_b.jpg');
  });

  it('handles string farm values', () => {
    const photo = {
      farm: '2',
      server: '789',
      id: '012',
      secret: 'xyz'
    };

    const url = constructImageUrl(photo);

    expect(url).toBe('https://farm2.staticflickr.com/789/012_xyz_b.jpg');
  });
});

describe('createCachedPhoto', () => {
  const basePhoto = {
    id: '123',
    title: 'Test Photo',
    farm: 1,
    server: '456',
    secret: 'abc',
    url_o: 'https://example.com/original.jpg',
    width_o: '800'
  };

  it('uses original URL when image is small enough', () => {
    const cached = createCachedPhoto(basePhoto, true);

    expect(cached.src).toBe('https://example.com/original.jpg');
    expect(cached.title).toBe('Test Photo');
    expect(cached.id).toBe('123');
    expect(cached.ownername).toBe('Adewale Oshineye');
    expect(cached.owner).toBe('adewale_oshineye');
  });

  it('uses constructed URL when original is too large and useSmallerImages is true', () => {
    const largePhoto = { ...basePhoto, width_o: '2000' };

    const cached = createCachedPhoto(largePhoto, true);

    expect(cached.src).toBe('https://farm1.staticflickr.com/456/123_abc_b.jpg');
  });

  it('uses original URL regardless of size when useSmallerImages is false', () => {
    const largePhoto = { ...basePhoto, width_o: '2000' };

    const cached = createCachedPhoto(largePhoto, false);

    expect(cached.src).toBe('https://example.com/original.jpg');
  });

  it('uses constructed URL when url_o is missing', () => {
    const noOriginal = { ...basePhoto, url_o: null };

    const cached = createCachedPhoto(noOriginal, false);

    expect(cached.src).toBe('https://farm1.staticflickr.com/456/123_abc_b.jpg');
  });

  it('uses constructed URL when url_o is empty string', () => {
    const emptyOriginal = { ...basePhoto, url_o: '' };

    const cached = createCachedPhoto(emptyOriginal, false);

    expect(cached.src).toBe('https://farm1.staticflickr.com/456/123_abc_b.jpg');
  });
});

describe('fetchPhotoset', () => {
  it('fetches and parses Flickr JSON API response', async () => {
    const mockPhotos = [
      { id: '1', title: 'Photo 1' },
      { id: '2', title: 'Photo 2' }
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'ok',
        photoset: { photo: mockPhotos }
      })
    });

    const photos = await fetchPhotoset('12345', 'API_KEY', mockFetch);

    expect(photos).toEqual(mockPhotos);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain('photoset_id=12345');
    expect(mockFetch.mock.calls[0][0]).toContain('api_key=API_KEY');
    expect(mockFetch.mock.calls[0][0]).toContain('format=json');
  });

  it('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    await expect(fetchPhotoset('12345', 'API_KEY', mockFetch))
      .rejects.toThrow('Flickr API error: 500');
  });

  it('throws on Flickr API error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'fail',
        message: 'Invalid API key'
      })
    });

    await expect(fetchPhotoset('12345', 'API_KEY', mockFetch))
      .rejects.toThrow('Flickr API returned: fail');
  });

  it('returns empty array when photoset has no photos', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'ok',
        photoset: {}
      })
    });

    const photos = await fetchPhotoset('12345', 'API_KEY', mockFetch);

    expect(photos).toEqual([]);
  });
});

describe('buildInitialCache', () => {
  const mockPhotos = [
    { id: '1', title: 'Photo 1', farm: 1, server: '100', secret: 'a', url_o: 'http://a.jpg', width_o: '800' },
    { id: '2', title: 'Photo 2', farm: 2, server: '200', secret: 'b', url_o: 'http://b.jpg', width_o: '800' },
    { id: '3', title: 'Photo 3', farm: 3, server: '300', secret: 'c', url_o: 'http://c.jpg', width_o: '800' }
  ];

  it('builds cache with up to targetSize photos', async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue({ useSmallerImages: true }),
      set: vi.fn().mockResolvedValue()
    };

    await buildInitialCache(mockPhotos, mockStorage, 2);

    expect(mockStorage.set).toHaveBeenCalledOnce();
    const savedCache = mockStorage.set.mock.calls[0][0].photoCache;
    expect(savedCache).toHaveLength(2);
  });

  it('includes all photos when fewer than targetSize available', async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue({ useSmallerImages: true }),
      set: vi.fn().mockResolvedValue()
    };

    await buildInitialCache(mockPhotos, mockStorage, 10);

    const savedCache = mockStorage.set.mock.calls[0][0].photoCache;
    expect(savedCache).toHaveLength(3);
  });

  it('creates cached photo objects with required fields', async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue({ useSmallerImages: false }),
      set: vi.fn().mockResolvedValue()
    };

    await buildInitialCache([mockPhotos[0]], mockStorage, 10);

    const savedCache = mockStorage.set.mock.calls[0][0].photoCache;
    expect(savedCache[0]).toMatchObject({
      src: expect.any(String),
      title: 'Photo 1',
      id: '1',
      ownername: 'Adewale Oshineye',
      owner: 'adewale_oshineye'
    });
  });
});

describe('refreshCache', () => {
  const mockPhotos = [
    { id: '1', title: 'Photo 1', farm: 1, server: '100', secret: 'a', url_o: 'http://a.jpg', width_o: '800' },
    { id: '2', title: 'Photo 2', farm: 2, server: '200', secret: 'b', url_o: 'http://b.jpg', width_o: '800' }
  ];

  it('removes oldest photo and adds new one when at capacity', async () => {
    const existingCache = [
      { id: 'old1', src: 'old1.jpg', title: 'Old 1', ownername: 'Test', owner: 'test' },
      { id: 'old2', src: 'old2.jpg', title: 'Old 2', ownername: 'Test', owner: 'test' }
    ];

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        photoCache: existingCache,
        useSmallerImages: true
      }),
      set: vi.fn().mockResolvedValue()
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'ok',
        photoset: { photo: mockPhotos }
      })
    });

    await refreshCache(mockStorage, mockFetch, '12345', 'API_KEY', 2);

    const savedCache = mockStorage.set.mock.calls[0][0].photoCache;
    expect(savedCache).toHaveLength(2);
    expect(savedCache[0].id).toBe('old2'); // old1 was removed
    expect(savedCache[1].id).toMatch(/^[12]$/); // new photo added
  });

  it('adds photo without removing when under capacity', async () => {
    const existingCache = [
      { id: 'old1', src: 'old1.jpg', title: 'Old 1', ownername: 'Test', owner: 'test' }
    ];

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        photoCache: existingCache,
        useSmallerImages: true
      }),
      set: vi.fn().mockResolvedValue()
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'ok',
        photoset: { photo: mockPhotos }
      })
    });

    await refreshCache(mockStorage, mockFetch, '12345', 'API_KEY', 5);

    const savedCache = mockStorage.set.mock.calls[0][0].photoCache;
    expect(savedCache).toHaveLength(2);
    expect(savedCache[0].id).toBe('old1'); // old1 kept
  });

  it('does nothing when fetch fails', async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue({ photoCache: [], useSmallerImages: true }),
      set: vi.fn().mockResolvedValue()
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    // Should not throw
    await refreshCache(mockStorage, mockFetch, '12345', 'API_KEY', 30);

    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('does nothing when no photos returned', async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue({ photoCache: [], useSmallerImages: true }),
      set: vi.fn().mockResolvedValue()
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stat: 'ok',
        photoset: { photo: [] }
      })
    });

    await refreshCache(mockStorage, mockFetch, '12345', 'API_KEY', 30);

    expect(mockStorage.set).not.toHaveBeenCalled();
  });
});
