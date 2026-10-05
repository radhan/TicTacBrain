import { useEffect, useState } from 'preact/hooks'

/**
 * Installation de la PWA.
 * - Chrome / Edge (Android, desktop) : on capture `beforeinstallprompt` pour proposer un
 *   vrai bouton « Installer ».
 * - Android sans cet événement (Firefox, Chrome avant ses critères d'engagement) :
 *   on explique le menu du navigateur.
 * - iPhone / iPad : Safari ne propose jamais l'installation ; on guide (« Partager »).
 * - Navigateurs intégrés (Instagram, Facebook…) : il faut d'abord ouvrir la page dans le
 *   vrai navigateur.
 */

export type InstallMode = 'prompt' | 'ios' | 'android-menu' | 'inapp'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'tictacbrain:install-dismissed'
/** Une fois refermée, la bannière revient au bout d'une semaine. */
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

// État partagé par tous les composants (bannière, bouton d'en-tête).
let deferred: BeforeInstallPromptEvent | null = null
let dismissed = typeof window !== 'undefined' && readDismissed()
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

const isInApp = () => /FBAN|FBAV|Instagram|Line\/|LinkedInApp|GSA\/|Snapchat|TikTok/i.test(navigator.userAgent)
const isAndroid = () => /Android/i.test(navigator.userAgent)

function currentMode(): InstallMode | null {
  if (isStandalone()) return null
  if (deferred) return 'prompt'
  if (isInApp()) return 'inapp'
  if (isIos()) return 'ios'
  if (isAndroid()) return 'android-menu'
  return null
}

export function useInstall() {
  const [, force] = useState(0)

  useEffect(() => {
    const update = () => force((n) => n + 1)
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])

  return {
    /** Ce qu'on peut proposer sur cet appareil, ou `null` (déjà installée, desktop sans support…). */
    mode: currentMode(),
    dismissed,
    /** Ouvre la boîte d'installation native (mode `prompt`). */
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => null)
      deferred = null
      notify()
    },
    dismiss() {
      dismissed = true
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
      } catch {
        // Stockage indisponible : la bannière reviendra simplement à la prochaine visite.
      }
      notify()
    },
    /** Réaffiche la bannière (bouton « Installer » de l'en-tête). */
    reopen() {
      dismissed = false
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {
        // Rien à faire.
      }
      notify()
    },
  }
}
