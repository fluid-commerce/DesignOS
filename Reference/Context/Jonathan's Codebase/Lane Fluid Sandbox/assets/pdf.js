document.addEventListener("DOMContentLoaded", () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

  document.querySelectorAll(".responsive-pdf-iframe").forEach((el) => {
    const url = el.getAttribute('data-url');
    const container = el.querySelector('.pdf-container');
    const loader = el.querySelector('.pdf-loader');

    if (!url || !container) return;

    pdfjsLib.getDocument(url).promise.then(pdf => {
      const totalPages = pdf.numPages;
      let renderedPages = 0;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        pdf.getPage(pageNum).then(page => {
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.style.display = 'block';
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          container.appendChild(canvas);

          const context = canvas.getContext('2d');
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          page.render(renderContext).promise.then(() => {
            renderedPages++;
            if (renderedPages === totalPages && loader) {
              loader.style.display = 'none'; 
              container.style.display = 'block';
            }
          });
        });
      }
    }).catch(err => {
      container.innerHTML = `<p>Failed to load PDF: ${err.message}</p>`;
      if (loader) loader.style.display = 'none';
      container.style.display = 'block';
    });
  });
});
