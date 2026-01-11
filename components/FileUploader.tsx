import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSelectFile = (file: File) => {
    setError(null);
    if (file.type !== 'application/pdf') {
      setError("Vui lòng chỉ tải lên file PDF.");
      return;
    }
    // Limit size increased to 200MB as requested
    if (file.size > 200 * 1024 * 1024) {
      setError("File quá lớn (Tối đa 200MB).");
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out text-center cursor-pointer
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"}
          ${error ? "border-red-300 bg-red-50" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="application/pdf"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className={`p-4 rounded-full ${error ? 'bg-red-100' : 'bg-blue-100'}`}>
            {error ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : (
              <Upload className="w-8 h-8 text-blue-500" />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {error ? "Lỗi tải file" : "Tải lên tài liệu scan"}
            </h3>
            <p className="text-sm text-gray-500">
              {error ? error : "Kéo thả file PDF vào đây hoặc click để chọn"}
            </p>
          </div>

          {!error && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              <FileText className="w-3 h-3" />
              <span>Hỗ trợ định dạng PDF (Max 200MB)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};