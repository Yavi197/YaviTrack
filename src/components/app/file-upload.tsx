
"use client";

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export type FileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface FileUploadProps {
  id: string;
  label: string;
  status: FileUploadStatus;
  fileName?: string | null;
  errorMessage?: string | null;
  onFileSelect: (file: File | null) => void;
  progress?: number;
}

export function FileUpload({
  id,
  label,
  status,
  fileName,
  errorMessage,
  onFileSelect,
  progress = 0,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleContainerClick = () => {
    if (status !== 'uploading') {
      inputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'uploading' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };
  
  const truncatedFileName = (name: string | null | undefined, maxLength: number = 30): string => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return `${name.substring(0, maxLength)}...`;
  };


  let content;

  switch (status) {
    case 'idle':
      content = (
        <div
          className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 px-6 py-8 transition-all hover:border-primary cursor-pointer"
          onClick={handleContainerClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="region"
          aria-label="Subir archivo"
          tabIndex={0}
        >
          <div className="flex w-full flex-col items-center gap-2">
            <p className="text-slate-900 dark:text-white text-base font-medium leading-tight text-center" id={`label-${id}`}>{label}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal text-center">Arrastre y suelte o haga clic para seleccionar</p>
          </div>
          <button type="button" className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-slate-300 dark:hover:bg-slate-700" aria-label="Seleccionar archivo">
            <span className="truncate">Seleccionar Archivo</span>
          </button>
        </div>
      );
      break;

    case 'uploading':
        content = (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                 <div className="text-primary flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-10">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white text-base font-medium leading-normal truncate">
                        {truncatedFileName(fileName, 40)}
                    </p>
                    <div className="flex items-center gap-2">
                         <Progress value={progress} className="h-1.5 flex-1" />
                         <p className="text-primary text-sm font-medium leading-normal shrink-0">{progress}%</p>
                    </div>
                </div>
            </div>
        );
        break;
      
    case 'success':
        content = (
             <div className="flex items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/50 px-4 py-3 rounded-lg border border-green-500/50">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="text-green-500 flex items-center justify-center rounded-full bg-green-500/10 shrink-0 size-10">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white text-base font-medium leading-normal truncate">
                            {truncatedFileName(fileName)}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Carga Completa!</p>
                    </div>
                </div>
                <button type="button" onClick={() => onFileSelect(null)} className="text-sm font-medium leading-normal text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-500 shrink-0">
                  Eliminar
                </button>
            </div>
        );
        break;

    case 'error':
        content = (
         <div className="flex items-center justify-between gap-3 bg-red-100 dark:bg-red-800/20 px-4 py-3 rounded-lg border border-red-500/50">
            <div className="flex items-center gap-3 min-w-0">
                <div className="text-red-500 flex items-center justify-center rounded-full bg-red-500/10 shrink-0 size-10">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white text-base font-normal leading-normal truncate">{truncatedFileName(fileName)}</p>
                    <p className="text-red-500 dark:text-red-400 text-xs font-semibold">{errorMessage || 'Error en la carga'}</p>
                </div>
            </div>
             <button type="button" onClick={handleContainerClick} className="text-sm font-medium leading-normal text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary shrink-0">
                Reintentar
             </button>
        </div>
        );
        break;
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        aria-labelledby={`label-${id}`}
      />
      {content}
    </div>
  );
}
