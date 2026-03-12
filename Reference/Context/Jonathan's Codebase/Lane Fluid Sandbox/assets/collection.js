let carouselCount = 1;

function initializeCarouselHandler(carouselCount) {
  const productCarousel = new Splide(`.product-carousel-${carouselCount}`, {
    perPage: 1,
    perMove: 1,
    speed: 500,
    mediaQuery: "min",
    interval: 5000,
    padding: {
      right: '64px'
    },
    gap: "24px",
    breakpoints: {
      576:{
        perPage: 2,
      },
      768: {
        perPage: 3,
      },
      1200:{
        gap: "48px",
        padding: {
          right: '80px'
        },
      }
    }
  });
  productCarousel.mount();
}

function productCarousel(){
  $('.product-carousel').each(function(){
    initializeCarouselHandler(carouselCount);
    carouselCount++;
  });
}

function setCarsouselContainerSpacing(){
  let paddingLeft = $('#dummy-container').offset().left;
  console.log('padd',paddingLeft)
  $('.carousel-container').each(function(){
    $(this).css('padding-left', paddingLeft + 'px');
  })

}
document.addEventListener("DOMContentLoaded", ()=>{
  productCarousel();
  setCarsouselContainerSpacing();
});

$(window).resize(function(){
  setCarsouselContainerSpacing();
})