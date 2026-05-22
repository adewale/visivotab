// Recorded structure from Flickr API documentation
// https://www.flickr.com/services/api/flickr.photosets.getPhotos.html
// This prevents mock drift - if Flickr changes their API, update this fixture

export const flickrPhotosetResponse = {
  stat: 'ok',
  photoset: {
    id: '72157627053006607',
    primary: '5934560785',
    owner: '35468147914@N01',
    ownername: 'Adewale Oshineye',
    photo: [
      {
        id: '5934560785',
        secret: 'a1b2c3d4e5',
        server: '6027',
        farm: 7,
        title: 'Sunset over the city',
        isprimary: '1',
        url_o: 'https://farm7.staticflickr.com/6027/5934560785_a1b2c3d4e5_o.jpg',
        width_o: '4288',
        height_o: '2848'
      },
      {
        id: '5934561234',
        secret: 'f6g7h8i9j0',
        server: '6028',
        farm: 7,
        title: 'Morning mist',
        isprimary: '0',
        url_o: 'https://farm7.staticflickr.com/6028/5934561234_f6g7h8i9j0_o.jpg',
        width_o: '1920',
        height_o: '1080'
      },
      {
        id: '5934562345',
        secret: 'k1l2m3n4o5',
        server: '6029',
        farm: 8,
        title: 'Urban landscape',
        isprimary: '0',
        // No url_o - tests fallback to constructed URL
        width_o: '3000',
        height_o: '2000'
      }
    ],
    page: 1,
    per_page: 500,
    pages: 1,
    total: 3,
    title: 'New Tab Photos'
  }
};

export const flickrErrorResponse = {
  stat: 'fail',
  code: 1,
  message: 'Photoset not found'
};

export const flickrEmptyResponse = {
  stat: 'ok',
  photoset: {
    id: '123',
    photo: [],
    page: 1,
    per_page: 500,
    pages: 0,
    total: 0
  }
};
