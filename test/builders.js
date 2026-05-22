// Test data builders - centralized, consistent test data creation
// Following the Builder pattern for readable, maintainable tests

let photoIdCounter = 1;

export function buildPhoto(overrides = {}) {
  const id = String(photoIdCounter++);
  return {
    id,
    title: `Photo ${id}`,
    farm: 1,
    server: '100',
    secret: `secret${id}`,
    url_o: `https://example.com/photo${id}_o.jpg`,
    width_o: '1920',
    height_o: '1080',
    ...overrides
  };
}

export function buildLargePhoto(overrides = {}) {
  return buildPhoto({
    width_o: '4000',
    height_o: '3000',
    ...overrides
  });
}

export function buildPhotoWithoutOriginal(overrides = {}) {
  const photo = buildPhoto(overrides);
  delete photo.url_o;
  return photo;
}

export function buildCachedPhoto(overrides = {}) {
  const id = String(photoIdCounter++);
  return {
    id,
    src: `https://example.com/cached${id}.jpg`,
    title: `Cached Photo ${id}`,
    ownername: 'Adewale Oshineye',
    owner: 'adewale_oshineye',
    ...overrides
  };
}

export function buildMockStorage(initialData = {}) {
  let data = { ...initialData };
  return {
    get: async (keys) => {
      const result = {};
      for (const key of keys) {
        if (key in data) result[key] = data[key];
      }
      return result;
    },
    set: async (items) => {
      data = { ...data, ...items };
    },
    _getData: () => data,
    _setData: (newData) => { data = newData; }
  };
}

export function buildMockFetch(response) {
  return async (url) => ({
    ok: true,
    json: async () => response,
    ...response._fetchOverrides
  });
}

export function buildFailingFetch(status = 500) {
  return async () => ({
    ok: false,
    status
  });
}

export function resetBuilders() {
  photoIdCounter = 1;
}
