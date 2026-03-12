function mobileMenu(){
  $(document).on("click",".menu-toggle-icon",function(){
    $("#primary-nav-menu").clone().appendTo("#mobile-menu-wrapper");
    $("#mobile-menu-section").addClass("show");
    $("#body-overlay").addClass("show mobile-menu-overlay");
  });

  $(document).on("click","#close-mobile-menu,.mobile-menu-overlay",function(){
    $("#mobile-menu-wrapper #primary-nav-menu").remove();
    $("#mobile-menu-section").removeClass("show");
    $("#mobile-country-language").removeClass("show");
    $("#body-overlay").removeClass("show mobile-menu-overlay");
  });

  // $(document).on("click","#mobile-menu-section .menu-has-children", function(){
  //   $(this).children('.sub-menu').slideToggle();
  // });
}

function language(){
  if ($("#languages:not(.tomselected)").length) {
    new TomSelect("#languages:not(.tomselected)", {
      allowEmptyOption: false,
      controlInput: null,
    })
  }
  if ($("#countries:not(.tomselected)").length) {
    new TomSelect("#countries:not(.tomselected)", {
      allowEmptyOption: false,
      create: false,
      maxItems: 1,
      searchField: ['text'],
      valueField: 'value',
      labelField: 'text',
      maxOptions: null,
      render: {
        option: function(data, escape) {
          return `
            <div class="option-wrapper">
              <div class="option-item">
                <span class="flag-icon fi fi-${escape(data.flag)}"></span>
                <span class="country-name">${escape(data.text)}</span>
              </div>
            </div>`;
        },
        item: function(data, escape) {
          return `
            <div class="selected-item">
              <span class="flag-icon fi fi-${escape(data.flag)}"></span>
              <span class="country-name">${escape(data.text)}</span>
            </div>`;
        }
      }
    });
  }

  $(document).on('click','#show-language-country-dropdown',function () {
    $(this).addClass('active');
    $('#transparent-overlay').addClass('show hide-language-country-dropdown');
  });

  $(document).on('click','.hide-language-country-dropdown',function () {
    $('#show-language-country-dropdown').removeClass('active');
    $(this).removeClass('show hide-language-country-dropdown');
  });

}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    let date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function setCookieCountryAndLanguge(){
  $(document).on('click', '.saveLocaleBtn', async function () {
    let country, language;
    if( $(this).hasClass('mobile-save-btn') ) {
      country = $(this).closest('.locale-selector').find('.country-selector').data("value");
      language = $(this).closest('.locale-selector').find('.language-selector').data("value");
    } else {
      country = $(this).closest('.locale-selector').find('.country-selector').val();
      language = $(this).closest('.locale-selector').find('.language-selector').val();
    }

    if (window.FluidCommerceSDK) {
      try {
        await window.FluidCommerceSDK.updateLocaleSettings({ country, language });
      } catch (error) {
        console.error("Error updating locale settings:", error);
      }
    } else {
      // Fallback when Fairshare is not enabled
      setCookie('fluid_language', language, 365);
      setCookie('fluid_country', country, 365);
    }

    location.href = location.pathname;
  });
}

function mobileCountryLanguage(){
  $(document).on("click","#show-language-and-country",function(){
    $("#mobile-country-language").addClass("show");
  });
  $(document).on("click","#close-language-and-country",function(){
    $("#mobile-country-language").removeClass("show");
  });
  $(document).on("keyup",".search-language,.search-country",function(){
    const searchText = $(this).val();
    const listToSearchSeelector = $(this).data("target");
    const pattern = new RegExp(searchText, "i");
    $("."+listToSearchSeelector).find("li").each(function() {
      var listItem = $(this);
      if (!(listItem.text().search(pattern) >= 0)) {
        listItem.hide();
      }
      if ((listItem.text().search(pattern) >= 0)) {
        $(this).css('display','flex');
      }
    });
  });
  $(document).on("click",".language-item,.country-item",function(){
    const itemHTML = $(this).html();
    const itemIso = $(this).data("value");
    const searchFieldSelector =  $(this).hasClass('language-item') ? $('.search-language') : $('.search-country');
    const currentSelectedItemSelector = $(this).hasClass('language-item') ? '#current-selected-language' : '#current-selected-country';
    const isSearchEnable = searchFieldSelector.val().length > 0;

    $(this).siblings("li").removeClass("selected");
    $(this).addClass("selected");
    $("#mobile-country-language").addClass("btn-enable");
    $(this).parent("ul").children(".current-selected-item").html(itemHTML);
    $(this).parent("ul").children(".current-selected-item").attr("data-value", itemIso);

    if( isSearchEnable  ){
      $(currentSelectedItemSelector).css('display','flex');
    }
  });
}

function tab(){
  $(document).on("click",".tab-menu-item",function(e){
    e.preventDefault();
    var tabMenuId = $(this).attr("id");
    var tabContentSelector = $(this).closest(".tab-menu").next(".tab-content");
    // add active class on tab menu item
    $(this).siblings("li").removeClass("active");
    $(this).addClass("active");

    // show/hide tab content
    tabContentSelector.children("li").css("display","none");
    tabContentSelector.children("li").removeClass("active");
    tabContentSelector.children("." + tabMenuId + "-content").css("display","block");
    tabContentSelector.children("." + tabMenuId + "-content").addClass("active");

  })
}

document.addEventListener("DOMContentLoaded", function () {
  mobileMenu();
  language();
  setCookieCountryAndLanguge();
  mobileCountryLanguage();
  tab();
  const siteStickyHeader = document.querySelector(".site-header:not(.media-header)");
  function handleScroll() {
    if (window.scrollY > 50) {
      siteStickyHeader?.classList?.add("is-sticky");
    } else {
      siteStickyHeader?.classList?.remove("is-sticky");
    }
  }

  window.addEventListener("scroll", handleScroll);
});


document.addEventListener("DOMContentLoaded", function () {
  var bannerObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (_mutation) {
      addJustNavBar()
    })
  })

  var domObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.id === 'fluid-script-banner') {
          addJustNavBar()
          var banner = document.getElementById('fluid-script-banner')
          bannerObserver.observe(banner, {
            attributes: true,
            attributeFilter: ['style'],
          })
        }
      })

      mutation.removedNodes.forEach((node) => {
        if (node.id === 'fluid-script-banner') {
          addJustNavBar()
          domObserver.disconnect()
          bannerObserver.disconnect()
        }
      })
    })
  })
  domObserver.observe(document.body, { childList: true, subtree: true })
})

function addJustNavBar() {
  setTimeout(function () {
    if ($('#fluid-script-banner').length) {
      const bannerHeight = $('#fluid-script-banner').innerHeight()

      const hasBanner = $('#fluid-script-banner').length > 0
      const bannerTop = parseInt($('#fluid-script-banner').css('top'), 10)
      const top = (hasBanner ? bannerHeight + Math.max(bannerTop, -Math.abs(bannerHeight)): 0)

      $('body').addClass('banner-is-enable').removeClass('banner-is-removed');
      $('.site-header:not(.media-header)')?.css({
        top
      })
    } else {
       $('.site-header:not(.media-header').css({top: 0})
       $('body').addClass('banner-is-removed').removeClass('banner-is-enable');
    }
  }, 0)
}
