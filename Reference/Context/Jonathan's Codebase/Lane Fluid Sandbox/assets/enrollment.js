function debounce(func, wait) {
  var timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}
function applyZoom() {
  var windowWidth = $(window).width();

  var zoomType = windowWidth <= 991 ? "inner" : "window";

  $(".ezplus").removeData("ezPlus").removeClass("ezplus").off();
  $(".ZoomContainer").remove();

  $("#enrollment-slider .splide__slide.is-active img").ezPlus({
    zoomType: zoomType, // Use 'inner' for mobile view, 'window' for larger screens
    zoomWindowFadeIn: 500,
    zoomWindowFadeOut: 500,
    lensFadeIn: 500,
    lensFadeOut: 500,
    lensSize: 100,
    cursor: "crosshair",
    responsive: true,
    zoomContainerAppendTo: "body",
    borderSize: 0,
  });
}
function slider(){
  var main = new Splide("#enrollment-slider", {
    arrows: false,
    pagination: true,
  });

  var thumbnails = new Splide("#enrollment-thumbnail-carousel", {
    isNavigation: true,
    pagination: false,
    arrows: false,
    interval: 2000,
    autoPlay: true,
    gap: '24px',
    perPage: 3,
    mediaQuery: "min",
    interval: 2000,
  });

  main.sync(thumbnails).mount();
  thumbnails.mount();

  applyZoom();

  main.on("moved", function () {
    applyZoom();
  });
}

$(document).ready(function(){
  slider();
});

$(window).resize(debounce(function () {
  applyZoom();
}, 250));
