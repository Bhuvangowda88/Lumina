import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  error?: string | null;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileSelect, isLoading, error }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer rounded-[40px] border-[1px] border-dashed transition-all duration-700 p-20 overflow-hidden flex flex-col items-center justify-center text-center",
          isDragActive 
            ? "border-natural-primary bg-natural-secondary shadow-inner" 
            : "border-natural-border hover:border-natural-primary/50 bg-white/40 backdrop-blur-sm",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="relative z-10 flex flex-col items-center">
          <motion.div 
            animate={isDragActive ? { scale: 1.2, rotate: 10 } : { scale: 1, rotate: 0 }}
            className={cn(
              "w-24 h-24 rounded-full mb-10 flex items-center justify-center transition-all duration-500 shadow-sm",
              isDragActive ? "bg-natural-primary text-white shadow-2xl" : "bg-natural-secondary text-natural-primary group-hover:bg-natural-primary/5 group-hover:scale-105"
            )}
          >
            <Upload size={32} strokeWidth={1.5} />
          </motion.div>
          
          <h3 className="text-3xl font-serif italic text-natural-text mb-4 tracking-tight">
            {isDragActive ? "Release to Synthesis" : "Ingest Material"}
          </h3>
          <p className="text-sm text-natural-muted mb-12 max-w-[320px] leading-relaxed font-medium uppercase tracking-widest text-[10px]">
            PDF, TXT, or Image files supported<br />
            <span className="opacity-40 italic">Max 10MB per unit</span>
          </p>
          
          <button className="group/btn relative px-12 py-5 bg-natural-primary text-white rounded-full font-bold uppercase text-[10px] tracking-[0.3em] overflow-hidden transition-all active:scale-95 shadow-2xl shadow-natural-primary/20">
            <span className="relative z-10 flex items-center gap-2">
              Browse Files
              <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          </button>
        </div>

        {/* Dynamic Background Noise/Effects during drag */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-dot-pattern opacity-10"
            />
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-8 flex items-center gap-3 p-4 text-sm font-medium text-red-600 bg-red-50/50 rounded-2xl border border-red-100/50 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
    </div>
  );
};
