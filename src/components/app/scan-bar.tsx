"use client";

import React, { useState, useEffect } from "react";
import { FileUpload, type FileUploadStatus } from "@/components/app/file-upload";

interface ScanBarProps {
  onFileSelect?: (file: File | null) => void;
  /** If provided, renders only a hidden file input with this id. */
  inputId?: string;
  /** When true, render only the hidden input (no UI). Use when parent provides custom UI). */
  onlyInput?: boolean;
}

export default function ScanBar({ onFileSelect, inputId = 'scan-bar', onlyInput = false }: ScanBarProps) {
  const [status, setStatus] = useState<FileUploadStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    setFileName(file ? file.name : null);
    if (!file) {
      setStatus("idle");
      onFileSelect?.(null);
      return;
    }

    setStatus("uploading");
    // Simular un procesamiento rápido para previsualización UI
    setTimeout(() => {
      setStatus("success");
      onFileSelect?.(file);
    }, 700);
  };

  useEffect(() => {
    // Soporte de pegar imagenes desde el portapapeles (screenshot)
    const handlePaste = (e: ClipboardEvent) => {
      try {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile?.();
            if (blob) {
              const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
              handleFile(file);
              e.preventDefault();
              return;
            }
          }
          // También soportar dataURI en texto pegado
          if (item.type === 'text/plain') {
            item.getAsString?.((text) => {
              if (typeof text === 'string' && text.startsWith('data:image')) {
                // convertir dataURI a blob
                fetch(text)
                  .then((res) => res.blob())
                  .then((blob) => {
                    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                    handleFile(file);
                  })
                  .catch(() => {});
              }
            });
          }
        }
      } catch (err) {
        // no bloquear el flujo si paste falla
      }
    };

    window.addEventListener('paste', handlePaste as any);
    return () => window.removeEventListener('paste', handlePaste as any);
  }, []);

  if (onlyInput) {
    return (
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)}
      />
    );
  }

  return (
    <div className="mb-1">
      <h3 className="text-xs font-semibold mb-1">Escanear / Cargar estudio</h3>
      <FileUpload
        id={inputId}
        label="Arrastre o seleccione el archivo"
        status={status}
        fileName={fileName}
        onFileSelect={handleFile}
        progress={status === "uploading" ? 32 : 100}
      />
    </div>
  );
}
