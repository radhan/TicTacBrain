import { useEffect, useState } from 'preact/hooks'

/**
 * Installation de la PWA.
 * - Android / Chrome / Edge : on capture `beforeinstallprompt` pour proposer un vrai
 *   bouton « Installer » (le navigateur ne l'affiche sinon que discrètement dans son menu).
 * - iPhone / iPad : Safari ne propose jamais l'installation ; on affiche un guide
 *   (« Partager » puis « Sur l'écran d'accueil »).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'tictacbrain:install-dismissed'

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

// Écouté dès le chargement du module : l'événement peut arriver avant le premier rendu.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function useInstall() {
  const [, force] = useState(0)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    const update = () => force((n) => n + 1)
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])

  const standalone = isStandalone()
  const mode: 'prompt' | 'ios' | null = standalone ? null : deferred ? 'prompt' : isIos() ? 'ios' : null

  return {
    /** `prompt` : bouton d'installation natif ; `ios` : guide manuel ; `null` : rien à proposer. */
    mode,
    dismissed,
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => null)
      deferred = null
      notify()
    },
    dismiss() {
      setDismissed(true)
      try {
        localStorage.setItem(DISMISS_KEY, '1')
      } catch {
        // Stockage indisponible : la bannière reviendra simplement à la prochaine visite.
      }
    },
  }
}
