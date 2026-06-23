'use client'

// Warn before leaving a dirty form. App Router has no built-in navigation-block
// event, so we cover the two realistic exits:
//   1. Tab close / reload / external nav → the native `beforeunload` prompt.
//   2. In-app link clicks → intercept the click on any anchor and confirm before
//      letting Next.js navigate.
// `router.back()`/`router.push()` calls the form makes itself are NOT guarded —
// the form disarms the guard on a successful save before navigating.

import { useEffect } from 'react'

const MESSAGE = 'You have unsaved changes. Leave this page and discard them?'

export function useUnsavedChangesGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    // 1. Native prompt for tab close / reload / typing a new URL.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy assignment kept for older browsers that gate the prompt on it.
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // 2. In-app anchor clicks → confirm. Capture phase so we can stop the click
    // before Next's Link handler runs. New-tab / modified clicks pass through.
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.target === '_blank') return
      if (!window.confirm(MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClickCapture, true)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [enabled])
}
