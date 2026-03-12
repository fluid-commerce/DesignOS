document.addEventListener('DOMContentLoaded', function () {

onElementInserted('body', 'select.custom-theme-select', function (e) {
  initSelect(e)
})

document.querySelectorAll('select.custom-theme-select').forEach(el => {
  initSelect(el)
})


function initSelect (el) {
  new TomSelect(el, {
    allowEmptyOption: false,
    controlInput: null,
  })
}

// Background image handler for data-bg attributes
function setBackgroundImages() {
  document.querySelectorAll('[data-bg]').forEach((element) => {
    const bgUrl = element.getAttribute('data-bg')
    if (bgUrl && bgUrl.trim() !== '') {
      element.style.backgroundImage = `url('${bgUrl}')`
      element.style.backgroundPosition = 'center center'
      element.style.backgroundSize = 'cover'
      element.style.backgroundRepeat = 'no-repeat'
    } else {
      // Clear background image if data-bg is empty
      element.style.backgroundImage = ''
    }
  })
}

// Initialize background images
setBackgroundImages()

// Also run on window load to catch any dynamically loaded content
window.addEventListener('load', setBackgroundImages)

// Run when DOM changes (for dynamic content)
const observer = new MutationObserver(setBackgroundImages)
observer.observe(document.body, { childList: true, subtree: true })

}); 