import { API } from './api.js';
// Рейтинг теперь полностью на сервере. Здесь — только хелперы для отображения.

export function loadMyRating() {
  return API.getMyRating().then(function (r) {
    return r.rating;
  });
}

export function setRatingPublic(isPublic) {
  return API.setRatingVisibility(isPublic).then(function (r) {
    return r.rating;
  });
}
