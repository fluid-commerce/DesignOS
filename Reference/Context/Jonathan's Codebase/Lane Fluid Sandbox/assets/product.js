
document.addEventListener('DOMContentLoaded', function () {

onElementInserted('body', 'select.custom-select', function (e) {
  initSelect(e)
})

onElementInserted('body', '#main-carousel', function (e) {
  productCarousel();  
})
  
document.querySelectorAll('select.custom-select').forEach(el => {
  initSelect(el)
})

function initSelect (el) {
  new TomSelect(el, {
    allowEmptyOption: false,
    controlInput: null,
    })
  }
});

function accordion(){
  $(document).on('click','.accordion-header',function(e){
    $(this).toggleClass('active');
    $(this).next('.accordion-content').slideToggle();
  });
}
function productCarousel(){
  var main = new Splide("#main-carousel", {
    arrows: false,
    pagination: false,
  });

  var thumbnails = new Splide("#thumbnail-carousel", {
    isNavigation: true,
    direction: "ttb",
    pagination: false,
    arrows: false,
    mediaQuery: "min",
    focus: "center",
    height: 400,
    gap: 16
  });

  main.sync(thumbnails).mount();
  thumbnails.mount();
}

function quantity() {
  $(document).on('change', '.quantity-input-field', function() {
    const addToCartBtn = document.querySelector("[data-fluid-add-to-cart]")
    if (addToCartBtn) {
      addToCartBtn.dataset.fluidQuantity = this.value;
    }

    if (this.max) {
      if (parseInt(this.value) >= parseInt(this.max)) {
        $('.error-messages-container').html(`<p class="error-message">This product is out of stock.</p>`);
      } else {
        $('.error-messages-container').html('');
      }
    }
  })
}

    
function observeVariantChange(){
  $(document).on('change', 'select.variation-dropdown', function () {
    let option_value_ids = [];
    $('select.variation-dropdown').each(function () {
      option_value_ids.push($(this).val());
    })
    const url = window.location.href.split('?')[0]
    const data = {
      option_value_ids: option_value_ids,
      subscription_plan:  $('select.subscription-plans-dropdown')?.val()
    };

    if ($('input[name="fluid-checkout-subscribe"]:checked')?.val() == 'subscription') {
      data.subscribe = true;
    }
    $.ajax({
      url: url,
      data: data,
      success: function (response) {
        // Parse the response and replace the form with id 'product-form'
        const newForm = $(response).find('main.product-detail-page-section'); // Extract the updated form
         updateSubscribeUI()
        if (newForm.length) {
          $('main.product-detail-page-section').replaceWith(newForm); // Replace the old form
        } else {
          console.error('Updated form not found in the response.');
        }
      },
    })
  });
}

function observeSubscriptionPlanChange() {
  $(document).on('change', '.subscription-plans-dropdown', function () {
     updateSubscriptionPrice()
     updateSubscribeUI()
  });
}

function updateSubscriptionPrice() {
  if ($('.subscription-plans-dropdown').length) {
    const price = $('.subscription-plans-dropdown').find(":selected").data('subscriptionPrice')
    $('.subscription-price').text(price)
  }
}

function updateSubscribeUI() {
  let subscribe = $('input[name="fluid-checkout-subscribe"]:checked')[0]?.value == 'subscription';
  let addToCartBtn = document.querySelector("[data-fluid-add-to-cart]");

  if (subscribe) {
    $('.subscription-plans')?.show();
    if (addToCartBtn) {
      addToCartBtn.dataset.fluidSubscriptionPlanId = $('select.subscription-plans-dropdown')?.val();
    }
  } else {
    $('.subscription-plans')?.hide();
    if (addToCartBtn) {
      addToCartBtn.dataset.fluidSubscriptionPlanId = '';
    }
  }
}

function observeSubscriptionChange() {
  $(document).on('change', 'input[name="fluid-checkout-subscribe"]', updateSubscribeUI);
}

document.addEventListener("DOMContentLoaded", ()=>{
  quantity();
  observeVariantChange();
  observeSubscriptionChange();
  observeSubscriptionPlanChange();
  updateSubscriptionPrice();
  accordion();
  productCarousel();  
  updateSubscribeUI();
});
