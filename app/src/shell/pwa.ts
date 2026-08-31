/* PAPER PLANET — service worker registration and update prompting. */

export interface PwaHandle {
  /** True when a new build is cached and waiting to take over. */
  updateReady: boolean
  /** Activate the waiting worker and reload. */
  applyUpdate: () => void
}

type UpdateListener = () => void

let waiting: ServiceWorker | null = null
const listeners = new Set<UpdateListener>()

export function onUpdateReady(fn: UpdateListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function applyUpdate() {
  if (!waiting) {
    window.location.reload()
    return
  }
  waiting.postMessage('skip-waiting')
  // The controllerchange handler below performs the reload.
}

/**
 * Register the worker. Safe to call unconditionally: it no-ops in dev, in
 * unsupported browsers, and on insecure origins.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker
      .register(url, { scope: './' })
      .then((reg) => {
        if (reg.waiting) {
          waiting = reg.waiting
          listeners.forEach((fn) => fn())
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            // Only prompt when there was already a controller; otherwise this
            // is the very first install and there is nothing to update from.
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              waiting = next
              listeners.forEach((fn) => fn())
            }
          })
        })
      })
      .catch(() => {
        /* Registration is a progressive enhancement; failure is not fatal. */
      })

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  })
}
