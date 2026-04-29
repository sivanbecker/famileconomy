'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error'

export interface ToastMessage {
  id: string
  message: string
  variant: ToastVariant
}

// ─── Store (module-level singleton, no React context needed) ──────────────────

type Listener = (toasts: ToastMessage[]) => void
let toasts: ToastMessage[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l([...toasts]))
}

export function toast(message: string, variant: ToastVariant = 'success') {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, message, variant }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    notify()
  }, 4000)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useToasts(): ToastMessage[] {
  const [state, setState] = useState<ToastMessage[]>([])

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return state
}

// ─── Dismiss helper ───────────────────────────────────────────────────────────

function dismiss(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

// ─── ToastContainer (mount once in root layout) ───────────────────────────────

export function ToastContainer() {
  const messages = useToasts()
  const handleDismiss = useCallback((id: string) => dismiss(id), [])

  if (messages.length === 0) return null

  return (
    <div aria-live="polite" className="fixed bottom-4 start-4 z-[100] flex flex-col gap-2">
      {messages.map(t => (
        <div
          key={t.id}
          role="status"
          className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-card-lg text-sm font-medium min-w-64 max-w-sm ${
            t.variant === 'success'
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {t.variant === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => handleDismiss(t.id)}
            aria-label="סגור"
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
