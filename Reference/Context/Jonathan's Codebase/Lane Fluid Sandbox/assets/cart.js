

document.addEventListener("fluidSdk:initialized", async function(){
  window.fluidCart = FluidSDK.getInstance().cart();
  fetchCart();
  addToCart();
});

async function fetchCart() {
  const response = await fluidCart.get();
  
  updateCartCount(response?.items?.length || 0);
}

function addToCart() {
  $('#add-to-cart-button').on('click', async function(e) {
    e.preventDefault();
    const variantId = $(this).data('variant')
    const quantity = parseInt($(this).closest('form')?.find('input[name="fluid-checkout-quantity"]')?.val() || 1)
    const enrollment_pack_id = $(this).data('fluid-enrollment-pack')
    let response;

    if ($.cookie('fluid_cart')) {
      if (enrollment_pack_id) {
        response = await fluidCart.enrollment(enrollment_pack_id)
      } else {
        response = await fluidCart.add([{ variant_id: variantId, quantity }])
      }
    } else {
      if (enrollment_pack_id) {
        response = await fluidCart.new({ enrollment_pack_id })
      } else {
        response = await fluidCart.new({
            items: [{ variant_id: variantId, quantity }]
          })
      }
    }
    
    updateCartCount(response.items.length);
  })
}

function updateCartCount(count) {
  $('#cart-count').text(count);
}