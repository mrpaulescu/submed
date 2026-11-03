const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

let pdfjsPromise = null;

export function isPdfFile(file) {
  return !!file && (
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name || '')
  );
}

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function renderPdfFirstPageToImageFile(file, {
  targetWidth = 1500,
  imageType = 'image/png',
} = {}) {
  if (!isPdfFile(file)) throw new Error('Fisierul incarcat nu este PDF.');
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    throw new Error('Latimea tinta pentru randarea PDF trebuie sa fie pozitiva.');
  }

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  try {
    if (pdf.numPages < 1) throw new Error('PDF-ul nu contine pagini.');
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        result ? resolve(result) : reject(new Error('Nu am putut converti PDF-ul in imagine.'));
      }, imageType);
    });

    const baseName = (file.name || 'scan.pdf').replace(/\.pdf$/i, '');
    return new File([blob], `${baseName}_page1.png`, {
      type: imageType,
      lastModified: file.lastModified || Date.now(),
    });
  } finally {
    await pdf.destroy();
  }
}
