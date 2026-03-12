// JavaScript for Tab and Nested Tab Functionality

document.addEventListener('DOMContentLoaded', () => {
  // Tab functionality
  const tabs = document.querySelectorAll('.tab-link')
  const tabContents = document.querySelectorAll('.tab-content')

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target')

      // Remove active class from all tabs and contents
      tabs.forEach((t) => t.classList.remove('active'))
      tabContents.forEach((content) => content.classList.remove('active'))

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active')
      document.getElementById(target).classList.add('active')
    })
  })

  // Nested Tab functionality
  const nestedTabs = document.querySelectorAll('.nested-tab-link')
  const nestedContents = document.querySelectorAll('.nested-tab-content')

  nestedTabs.forEach((nestedTab) => {
    nestedTab.addEventListener('click', () => {
      const target = nestedTab.getAttribute('data-target')

      // Remove active class from all nested tabs and contents
      nestedTabs.forEach((nt) => nt.classList.remove('is-active'))
      nestedContents.forEach((nestedContent) =>
        nestedContent.classList.remove('is-active')
      )

      // Add active class to clicked nested tab and corresponding content
      nestedTab.classList.add('is-active')
      document.getElementById(target).classList.add('is-active')
    })
  })
})
