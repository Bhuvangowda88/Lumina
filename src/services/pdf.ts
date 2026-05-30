import * as pdfjsLib from 'pdfjs-dist';

// Use Vite's asset helper to get the worker URL
// This ensures the worker is correctly bundled and served
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    
    return fullText.trim();
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    throw new Error("Failed to process PDF. The file might be corrupted or password-protected.");
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return extractTextFromPdf(file);
  } else if (file.type === 'text/plain') {
    return file.text();
  } else {
    throw new Error("Unsupported file format. Please upload a PDF or TXT file.");
  }
}
