// Рейтинг теперь полностью на сервере. Здесь — только хелперы для отображения.

function loadMyRating() {
  return API.getMyRating().then(function (r) {
    return r.rating;
  });
}

function setRatingPublic(isPublic) {
  return API.setRatingVisibility(isPublic).then(function (r) {
    return r.rating;
  });
}
