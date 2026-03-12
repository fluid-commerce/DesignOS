function setBackgroundFromMedia() {
  document.querySelectorAll('.media-content').forEach((divElement) => {
    // Check for <figure> with <img> inside
    const imgElement = divElement.querySelector('figure img')
    if (imgElement) {
      const imgSrc = imgElement.getAttribute('src')
      divElement.style.backgroundImage = `url('${imgSrc}')`
    }

    const videoElement = divElement.querySelector('video')
    if (videoElement) {
      const posterUrl = videoElement.getAttribute('poster')
      if (posterUrl) {
        divElement.setAttribute('data-bg', posterUrl)
      }
    }
  })
}

// Execute the function
setBackgroundFromMedia()

document.addEventListener('DOMContentLoaded', () => {
  const mediaHeader = document.querySelector('.media-header')
  const mediaMain = document.querySelector('.media')
  const mediaSidebar = document.querySelector('.media-sidebar')

  function adjustMediaHeight() {
    if (mediaHeader && mediaMain) {
      const headerHeight = mediaHeader.clientHeight

      // Adjust mediaMain height
      mediaMain.style.height = `calc(100vh - ${headerHeight}px)`

      // Adjust mediaSidebar height only if the window width is above 768px
      if (mediaSidebar) {
        if (window.innerWidth > 768) {
          mediaSidebar.style.height = `calc(100vh - ${headerHeight}px)`
        } else {
          mediaSidebar.style.height = '' // Reset height for smaller screens
        }
      }
    }
  }

  // Initial adjustment
  adjustMediaHeight()

  // Adjust height on window resize
  window.addEventListener('resize', adjustMediaHeight)
})