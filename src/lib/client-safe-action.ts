"use client";

import type { ReactNode } from "react";

const STALE_PATTERNS = [
  "Failed to find Server Action",
  "Cannot read properties of undefined (reading 'workers')",
];

export type ToastFn = (toast: {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive" | null;
  action?: ReactNode;
}) => void;

export function isStaleServerActionError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && "message" in error
        ? String((error as any).message ?? "")
        : "";
  return STALE_PATTERNS.some((pattern) => message.includes(pattern));
}

export function handleServerActionError({
  error,
  toast,
  actionLabel = "la acción",
  reloadDelayMs = 1250,
  notifyOnNonStale = false,
  logger = console.error,
}: {
  error: unknown;
  toast?: ToastFn;
  actionLabel?: string;
  reloadDelayMs?: number;
  notifyOnNonStale?: boolean;
  logger?: (error: unknown) => void;
}): boolean {
  const stale = isStaleServerActionError(error);
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message ?? "")
        : "";

  if (stale) {
    toast?.({
      variant: "destructive",
      title: "Actualizamos la app",
      description:
        "Medi-Track instaló una nueva versión. Recargaremos para evitar errores.",
    });
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }, reloadDelayMs);
    logger?.(error);
    return true;
  }

  if (notifyOnNonStale && toast) {
    toast({
      variant: "destructive",
      title: "Error inesperado",
      description: message || `No se pudo completar ${actionLabel}.`,
    });
    logger?.(error);
    return true;
  }

  logger?.(error);
  return false;
}
