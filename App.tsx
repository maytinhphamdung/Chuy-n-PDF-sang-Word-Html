import React, { useState, useEffect, useRef } from 'react';
import { FileUploader } from './components/FileUploader';
import { PageResult } from './components/PageResult';
import { loadPdf, renderPageToImage } from './services/pdfUtils';
import { analyzePdfPage } from './services/geminiService';
// Removed Key, ExternalLink, Save from imports as they are no longer needed
import { Sparkles, FileText, Trash2, Play, Loader2, ChevronRight, AlertCircle, RefreshCw, Calculator, Timer, FileType, Code, Languages, Globe, CheckCircle2, Clock } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PageItem {
  pageNumber: number;
  originalImage: string | null;
  extractedHtml: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  retryCount: number;
  isSelected: boolean; // New: Check if page should be processed
}

const LANGUAGES = [
  { code: 'Vietnamese', label: 'Tiếng Việt' },
  { code: 'English', label: 'Tiếng Anh' },
  { code: 'French', label: 'Tiếng Pháp' },
  { code: 'Japanese', label: 'Tiếng Nhật' },
  { code: 'Korean', label: 'Tiếng Hàn' },
  { code: 'Chinese', label: 'Tiếng Trung' },
  { code: 'German', label: 'Tiếng Đức' },
  { code: 'Russian', label: 'Tiếng Nga' },
];

const App: React.FC = () => {
  
  // App State
  const [file, setFile] = useState<File | null>(null);
  
  // We use both state (for rendering) and a ref (for async logic source of truth)
  const [pages, setPages] = useState<PageItem[]>([]);
  const pagesRef = useRef<PageItem[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<number>(1);
  const [stopRequested, setStopRequested] = useState(false);
  const [timer, setTimer] = useState(0); // Timer in seconds
  
  // Translation State
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('English');

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  // Helper to count words
  const countWordsInHtml = (html: string): number => {
    if (!html) return 0;
    // Strip HTML tags and normalize whitespace
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    return text.split(' ').length;
  };

  // Derived state for total words
  const totalWords = pages.reduce((acc, page) => {
    return acc + (page.status === 'done' ? countWordsInHtml(page.extractedHtml) : 0);
  }, 0);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to update both Ref and State
  // This ensures the UI updates, but async loops can read pagesRef.current for latest data
  const updatePageData = (pageNumber: number, updates: Partial<PageItem>) => {
    const newPages = pagesRef.current.map(p => 
      p.pageNumber === pageNumber ? { ...p, ...updates } : p
    );
    pagesRef.current = newPages;
    setPages(newPages);
  };

  const updateAllPages = (newPages: PageItem[]) => {
    pagesRef.current = newPages;
    setPages(newPages);
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoadingPdf(true);
    setPages([]);
    pagesRef.current = [];
    setSelectedPageId(1);
    setStopRequested(false);
    setTimer(0);
    
    try {
      const pdf = await loadPdf(selectedFile);
      pdfDocRef.current = pdf;
      
      const newPages: PageItem[] = [];
      const numPages = pdf.numPages;

      for (let i = 1; i <= numPages; i++) {
        newPages.push({
          pageNumber: i,
          originalImage: null,
          extractedHtml: '',
          status: 'pending',
          retryCount: 0,
          isSelected: true // Default select all
        });
      }
      
      updateAllPages(newPages);

      if (numPages > 0) {
        ensurePageImageLoaded(1);
      }

    } catch (err) {
      console.error(err);
      alert("Không thể đọc file PDF. Vui lòng thử lại.");
      setFile(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  const ensurePageImageLoaded = async (pageNumber: number) => {
    if (!pdfDocRef.current) return;
    
    // Read from Ref to check if image exists
    const pageIndex = pagesRef.current.findIndex(p => p.pageNumber === pageNumber);
    if (pageIndex === -1) return;
    
    if (pagesRef.current[pageIndex].originalImage) return;

    try {
      const imageData = await renderPageToImage(pdfDocRef.current, pageNumber);
      updatePageData(pageNumber, { originalImage: imageData });
    } catch (error) {
      console.error(`Failed to render page ${pageNumber}`, error);
    }
  };

  useEffect(() => {
    if (selectedPageId && pages.length > 0) {
      ensurePageImageLoaded(selectedPageId);
    }
  }, [selectedPageId]);

  const togglePageSelection = (pageNumber: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the page for view
    const page = pagesRef.current.find(p => p.pageNumber === pageNumber);
    if (page) {
        updatePageData(pageNumber, { isSelected: !page.isSelected });
    }
  };

  const handleUpdateHtml = (pageNumber: number, newHtml: string) => {
    updatePageData(pageNumber, { extractedHtml: newHtml });
  };

  const resetApp = (confirmReset = true) => {
    if (!confirmReset || confirm("Bạn có chắc chắn muốn xóa file hiện tại?")) {
      setFile(null);
      setPages([]);
      pagesRef.current = [];
      setIsProcessing(false);
      setSelectedPageId(1);
      setTimer(0);
      pdfDocRef.current = null;
    }
  };

  const stopExtraction = () => {
    setStopRequested(true);
  };

  const startExtraction = async () => {
    if (isProcessing) return; // Prevent double click
    
    // Always use Ref to check current status
    const hasPendingSelected = pagesRef.current.some(p => p.isSelected && p.status !== 'done');
    if (!hasPendingSelected) {
      alert("Vui lòng chọn ít nhất một trang chưa hoàn thành để bắt đầu.");
      return;
    }

    setIsProcessing(true);
    setStopRequested(false);

    // Find the first page that needs processing
    // We iterate by index to control the loop easily
    let currentIndex = 0;
    
    // Optimization: jump to first pending page
    const firstPendingIndex = pagesRef.current.findIndex(p => p.isSelected && (p.status === 'pending' || p.status === 'error'));
    if (firstPendingIndex !== -1) {
      currentIndex = firstPendingIndex;
    }

    while (currentIndex < pagesRef.current.length) {
      // Re-check stop flag at start of loop
      if (stopRequested) break;

      // Always get the LATEST version of the page from Ref
      const currentPage = pagesRef.current[currentIndex];

      // SKIP conditions:
      // 1. Not selected
      // 2. Already DONE (Crucial check to prevent reprocessing)
      if (!currentPage.isSelected || currentPage.status === 'done') {
        currentIndex++;
        continue;
      }

      // If we are here, we are processing this page.
      // 1. Ensure image is loaded
      let originalImage = currentPage.originalImage;
      
      // Focus UI on this page
      setSelectedPageId(currentPage.pageNumber);

      if (!originalImage && pdfDocRef.current) {
        try {
          originalImage = await renderPageToImage(pdfDocRef.current, currentPage.pageNumber);
          updatePageData(currentPage.pageNumber, { originalImage });
        } catch (e) {
           console.error("Error rendering image for processing", e);
           updatePageData(currentPage.pageNumber, { 
             status: 'error', 
             extractedHtml: 'Lỗi không thể đọc hình ảnh trang này.' 
           });
          currentIndex++;
          continue;
        }
      }

      // 2. Set Status to Processing
      updatePageData(currentPage.pageNumber, { status: 'processing' });

      // 3. Call API with Retries
      const MAX_RETRIES = 3;
      let attempt = 0;
      let success = false;
      let finalHtml = '';

      while (attempt < MAX_RETRIES && !success) {
        if (stopRequested) break;
        
        try {
          if (attempt > 0) console.log(`Retrying page ${currentPage.pageNumber}, attempt ${attempt + 1}`);
          
          // Pass target language if translation is enabled
          const lang = translateEnabled ? targetLanguage : undefined;
          
          // Use system API Key implicitly via service
          finalHtml = await analyzePdfPage(originalImage!, lang);
          
          if (finalHtml.includes('Lỗi khi xử lý trang này') || finalHtml.includes('Error')) {
             throw new Error("AI Service returned error text");
          }

          success = true;
        } catch (error) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            // Backoff delay
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          } else {
            console.error(`Failed after ${MAX_RETRIES} attempts`, error);
          }
        }
      }

      // 4. Update Final Status
      if (success) {
        updatePageData(currentPage.pageNumber, { 
            status: 'done', 
            extractedHtml: finalHtml 
        });
      } else {
        updatePageData(currentPage.pageNumber, { 
            status: 'error', 
            extractedHtml: 'Đã thử lại 3 lần nhưng thất bại. Có thể do lỗi mạng hoặc giới hạn API.' 
        });
      }
      
      // Move to next page
      currentIndex++;
      
      // Small delay between pages to be nice to the API/Browser
      if (!stopRequested && currentIndex < pagesRef.current.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsProcessing(false);
    setStopRequested(false);
  };

  const getCommonCss = () => `
    body { font-family: 'Times New Roman', serif; line-height: 1.5; color: #000; }
    img { max-width: 100%; height: auto; }
    h1, h2, h3, h4, h5, h6 { color: #000; margin-top: 1em; margin-bottom: 0.5em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #000; padding: 6px; text-align: left; }
    p { margin-bottom: 1em; text-align: justify; }
  `;

  const handleDownloadHtml = () => {
    const completedPages = pages.filter(p => p.status === 'done' && p.isSelected);
    if (completedPages.length === 0) {
      alert("Chưa có trang nào được trích xuất xong.");
      return;
    }

    const content = `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${file?.name || 'Document'} - Extracted Content</title>
<style>
  ${getCommonCss()}
  body { max-width: 800px; margin: 0 auto; padding: 40px; }
  .page-container { margin-bottom: 50px; border-bottom: 1px dashed #ccc; padding-bottom: 20px; }
  .page-header { color: #888; font-size: 0.9em; margin-bottom: 20px; text-align: center; }
  @media print {
    .page-container { page-break-after: always; border-bottom: none; }
  }
</style>
</head>
<body>
${completedPages.map(p => `
  <div class="page-container" id="page-${p.pageNumber}">
    <div class="page-header">--- Trang ${p.pageNumber} ---</div>
    <div class="page-content">
      ${p.extractedHtml || '<p><i>(Không có nội dung)</i></p>'}
    </div>
  </div>
`).join('')}
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.pdf$/i, '')}_extracted.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDoc = () => {
    const completedPages = pages.filter(p => p.status === 'done' && p.isSelected);
    if (completedPages.length === 0) {
      alert("Chưa có trang nào được trích xuất xong.");
      return;
    }

    // Creating a HTML document compatible with MS Word
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
    <meta charset="utf-8">
    <title>${file?.name || 'Document'}</title>
    <style>
      ${getCommonCss()}
      /* MS Word specific styles */
      @page { mso-page-orientation: portrait; size: 21cm 29.7cm; margin: 2.54cm; }
    </style>
    </head><body>`;
    
    const postHtml = "</body></html>";
    
    const innerContent = completedPages.map(p => `
      <div class="WordSection${p.pageNumber}">
        <p style="text-align: center; color: #888; font-size: 10pt;">--- Trang ${p.pageNumber} ---</p>
        ${p.extractedHtml}
        <br clear=all style='mso-special-character:line-break;page-break-before:always'>
      </div>
    `).join('');

    const html = preHtml + innerContent + postHtml;

    const blob = new Blob(['\ufeff', html], {
        type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // .doc extension ensures Word opens it correctly as Web Layout or Print Layout
    a.download = `${file?.name.replace(/\.pdf$/i, '')}_extracted.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Find the selected page data from the state (for rendering)
  // We use the state 'pages' here, not 'pagesRef.current', because we want React to re-render when state changes.
  const selectedPage = pages.find(p => p.pageNumber === selectedPageId);
  
  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans overflow-hidden">
      {/* App Header */}
      <header className="bg-white border-b border-gray-200 h-14 flex-shrink-0 z-20">
        <div className="max-w-full mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">PDF Extractor AI</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {file && (
               <button 
                  onClick={() => resetApp(true)}
                  className="text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
               >
                  <Trash2 className="w-4 h-4" />
                  <span>Đóng file</span>
               </button>
            )}
          </div>
        </div>
      </header>

      {/* Content Area */}
      {!file && !loadingPdf ? (
        // Upload View
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <div className="text-center mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Chuyển đổi PDF Scan sang HTML</h2>
            <p className="text-lg text-gray-600">
              Tải lên tài liệu scan của bạn. Gemini AI sẽ phân tích từng trang, nhận diện văn bản và tái tạo lại định dạng.
            </p>
          </div>
          <FileUploader onFileSelect={handleFileSelect} />
          
          <div className="flex justify-center gap-8 mt-16 text-gray-400">
             <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </div>
                <span className="text-sm font-medium">AI thông minh</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <span className="text-sm font-medium">Giữ định dạng</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <span className="text-sm font-medium">Xuất HTML/Word</span>
             </div>
          </div>
        </div>
      ) : loadingPdf ? (
        // Loading View
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
           <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
           <p className="text-gray-500 font-medium">Đang đọc tài liệu PDF ({file?.name})...</p>
        </div>
      ) : (
        // Workspace View (Sidebar + Main)
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar */}
          <aside className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10">
            {/* Sidebar Stats */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 gap-2 text-xs text-gray-600 font-medium">
              <div className="flex items-center gap-1.5" title="Thời gian xử lý">
                <Timer className="w-3.5 h-3.5 text-blue-500" />
                <span>{formatTime(timer)}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end" title="Tổng số từ đã trích xuất">
                <Calculator className="w-3.5 h-3.5 text-green-600" />
                <span>{totalWords.toLocaleString()} từ</span>
              </div>
            </div>

            {/* Sidebar Actions */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-gray-100 rounded">
                  <FileText className="w-4 h-4 text-gray-600" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-gray-900 text-sm truncate" title={file?.name}>{file?.name}</h3>
                  <p className="text-xs text-gray-500">{pages.length} trang</p>
                </div>
              </div>

              {/* Translation Controls */}
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-900">Dịch thuật AI</span>
                  </div>
                  <div className="relative inline-block w-8 h-4 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      name="translate" 
                      id="translate-toggle" 
                      checked={translateEnabled}
                      onChange={(e) => setTranslateEnabled(e.target.checked)}
                      className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-indigo-600 right-4 border-gray-300"
                    />
                    <label htmlFor="translate-toggle" className={`toggle-label block overflow-hidden h-4 rounded-full cursor-pointer ${translateEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}></label>
                  </div>
                </div>
                
                {translateEnabled && (
                  <div className="flex items-center gap-2 mt-2">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    <select 
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="flex-1 text-xs border border-indigo-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-indigo-900"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {/* Start/Stop Button */}
                {!isProcessing ? (
                  <button
                    onClick={startExtraction}
                    disabled={!pages.some(p => p.isSelected && p.status !== 'done')}
                    className={`
                      w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm shadow-sm transition-all
                      ${!pages.some(p => p.isSelected && p.status !== 'done')
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}
                    `}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {pages.some(p => p.status === 'done') ? "Tiếp tục xử lý" : "Bắt đầu trích xuất"}
                  </button>
                ) : (
                   <button
                    onClick={stopExtraction}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm shadow-sm transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dừng lại
                  </button>
                )}
                
                {/* Download Buttons Grid */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={handleDownloadHtml}
                    disabled={!pages.some(p => p.status === 'done')}
                    className={`
                      flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs border transition-all
                      ${!pages.some(p => p.status === 'done')
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-blue-600'}
                    `}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Tải HTML
                  </button>

                  <button
                    onClick={handleDownloadDoc}
                    disabled={!pages.some(p => p.status === 'done')}
                    className={`
                      flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs border transition-all
                      ${!pages.some(p => p.status === 'done')
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-blue-600'}
                    `}
                  >
                    <FileType className="w-3.5 h-3.5" />
                    Tải Word
                  </button>
                </div>
              </div>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
              {pages.map((page) => (
                <div 
                  key={page.pageNumber}
                  className={`relative flex items-center gap-2 p-2 rounded-xl border transition-all group
                    ${selectedPageId === page.pageNumber 
                      ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200 z-10' 
                      : !page.isSelected ? 'opacity-50 grayscale border-gray-100 bg-gray-50'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                  `}
                >
                  <input 
                    type="checkbox"
                    checked={page.isSelected}
                    onChange={(e) => togglePageSelection(page.pageNumber, e as any)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 ml-1 cursor-pointer"
                    title={page.isSelected ? "Bỏ chọn để không xử lý trang này" : "Chọn để xử lý trang này"}
                  />
                  
                  <button
                    onClick={() => setSelectedPageId(page.pageNumber)}
                    className="flex-1 flex items-center justify-between text-left min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors
                        ${page.status === 'done' ? 'bg-green-100 text-green-700' : 
                          page.status === 'processing' ? 'bg-blue-100 text-blue-700' : 
                          page.status === 'error' ? 'bg-red-100 text-red-700' :
                          selectedPageId === page.pageNumber ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}
                      `}>
                        {page.pageNumber}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-sm font-medium block truncate ${selectedPageId === page.pageNumber ? 'text-blue-900' : 'text-gray-700'}`}>
                          Trang {page.pageNumber}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                          {!page.isSelected ? 'Đã bỏ qua' : (
                            <>
                              {page.status === 'pending' && <><Clock className="w-3 h-3" /> Chờ xử lý</>}
                              {page.status === 'processing' && <span className="text-blue-600">Đang xử lý...</span>}
                              {page.status === 'done' && <span className="text-green-600">Hoàn tất</span>}
                              {page.status === 'error' && <span className="text-red-500">Lỗi</span>}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* Status Indicator Icon */}
                    <div className="text-gray-300 pl-2">
                      {page.isSelected && (
                        <>
                          {page.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                          {page.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                          {page.status === 'error' && <RefreshCw className="w-4 h-4 text-red-500" />}
                          {page.status === 'pending' && <ChevronRight className={`w-4 h-4 transition-transform ${selectedPageId === page.pageNumber ? 'translate-x-1 text-blue-400' : 'group-hover:translate-x-1'}`} />}
                        </>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 bg-gray-100 p-4 lg:p-6 overflow-hidden flex flex-col relative">
            {selectedPage ? (
              <PageResult 
                pageNumber={selectedPage.pageNumber}
                status={selectedPage.status}
                originalImage={selectedPage.originalImage}
                extractedHtml={selectedPage.extractedHtml}
                onSaveHtml={(newHtml) => handleUpdateHtml(selectedPage.pageNumber, newHtml)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                <p>Chọn một trang để xem chi tiết</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default App;