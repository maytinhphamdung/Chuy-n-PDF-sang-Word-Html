import * as pdfjsLib from 'pdfjs-dist';

// Define the worker source. 
// We use unpkg to fetch the exact version matching the library.
// We use the .mjs extension to ensure it is loaded as an ES module, which prevents the "Failed to fetch dynamically imported module" error.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface PdfPageData {
  pageNumber: number;
  imageData: string; // Base64 encoded image
}

export const loadPdf = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

export const renderPageToImage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 1.5): Promise<string> => {
  const page = await pdf.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error("Could not get canvas context");
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext as any).promise;
  
  // Convert to JPEG for better compression/token usage with Gemini
  return canvas.toDataURL('image/jpeg', 0.8);
};