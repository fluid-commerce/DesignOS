document.addEventListener("DOMContentLoaded", function(){
  if (FluidCommerceSDK) {
    fetchCart();
    updateQuantityAndCart();
    $('a.checkout-btn').on('click', function(e) {
      e?.preventDefault();
      FluidCommerceSDK.checkout();
    })
  }
})
document.addEventListener("fluidSdk:initialized", function(){
  window.fluidCart = FluidSDK.getInstance().cart();
  updateQuantityAndCart();
});

async function fetchCart() {
  response = await FluidCommerceSDK.getCart();
  renderCartItems(response)
}


function addItemHandler(item) {
  let itemsTemplate = $($('template#cart-item-template')[0].content.cloneNode(true));
  itemsTemplate.find('.cart-product-item').attr('data-variant-id', item.variant_id)
  itemsTemplate.find('.product-title').text(item.product.title)
  itemsTemplate.find('.product-image').attr('src', item.product.image_url)
  itemsTemplate.find('.product-price').text(item.price_in_currency)
  itemsTemplate.find('.quantity').val(item.quantity)
  itemsTemplate.find('.variant').text(item.variant_title)

  $('#cart-items').append(itemsTemplate);
}

function updateQuantityAndCart() {
  $(document).on('change','select.quantity',async function(){
    const variantId = $(this).closest('.cart-product-item').data('variant-id');
    const quantity = $(this).val();
    if (FluidCommerceSDK) {
      await FluidCommerceSDK.updateCartItems([{ variant_id: variantId, quantity: quantity}])
      fetchCart();
    } else {
      const response= await fluidCart.updateQuantity({variant_id: variantId, quantity});
      renderCartItems(response)
    }
  });

  $(document).on('click', '.remove-product', async function() {
    const variantId = $(this).closest('.cart-product-item').data('variant-id');
    const quanityToRemove = $(this).closest('.cart-product-item').find('select.quantity').val()
    if (FluidCommerceSDK) {
      await FluidCommerceSDK.removeCartItem(variantId, { quantity: quanityToRemove })
      fetchCart();
    } else {
      const response= await fluidCart.updateQuantity({variant_id: variantId, quantity: 0});
      renderCartItems(response)
    }
  })
}

function renderCartItems(response) {
  $('#cart-items').empty();
  response?.items?.forEach(function(item) {
    addItemHandler(item);
  });

  $('.subtotal').text(response?.sub_total_in_currency)
  $('.shipping').text(response?.shipping_total_for_display)
  $('.tax').text(response?.tax_total_in_currency)
  $('.total').text(response?.amount_total_in_currency)
}