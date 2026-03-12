document.addEventListener('DOMContentLoaded', () => {
  $('input.comment-body').on('input', function () {
    if ($(this).val().length > 0) {
      $('.submitComment').removeAttr('disabled')
    } else {
      $('.submitComment').attr('disabled', 'disabled')
    }
  })
  
  $('.commentForm').on('submit', function (e) {
    e?.preventDefault()
    submitForm()
  })

  $('.submitComment').on('click', function (e) {
    e.preventDefault()
    submitForm()
  })

  function submitForm() {
    if (isContactsDetailsCurrentlyPresent()) {
      $('#commentContactDialog')[0].close()
      submitCommentForm()
    } else {
      $('#commentContactDialog')[0].showModal()
    }
  }
  $('.dialog-close').on('click', function () {
    $('#commentContactDialog')[0].close()
  })

  function isContactsDetailsCurrentlyPresent() {
    return !(
      $('.contactFullName').val() == '' || $('.contactEmail').val() == ''
    )
  }

  function submitCommentForm() {
    $('#contact_presence')?.val('true')
    var form = $('.comment-form')
    var actionUrl = form.attr('action')

    $.ajax({
      type: 'POST',
      url: actionUrl,
      data: form.serialize(),
      success: function (data) {
        $('.comment-body').val('');
        $('.submitComment').attr('disabled', 'disabled')
        if (data.success) {
          const commentTemplate = document.querySelector('template#comment-template').content.cloneNode(true)
          $(commentTemplate).find('.initials').text(data.comment.initials)
          $(commentTemplate).find('.name').text(data.comment.name)
          $(commentTemplate).find('.created_at').text(data.comment.created_at)
          $(commentTemplate).find('.body').text(data.comment.body)
          $('.comment-list').append(commentTemplate)
        }
      },
    })
  }
})
