import { useEffect } from 'preact/hooks'
import { useRegisterSW } from 'virtual:pwa-register/preact'

/**
 * Prévient quand une nouvelle version (souvent : de nouvelles questions !) est disponible.
 * Reste monté en permanence (il enregistre le service worker) mais se tait pendant une partie.
 */
export function UpdateToast({ hidden }: { hidden: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Vérifie les mises à jour toutes les heures si l'app reste ouverte.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady])

  if (hidden) return null
  if (needRefresh) {
    return (
      <div class="toast" role="status">
        <span>✨ Nouvelle version disponible</span>
        <button type="button" class="btn btn-small btn-primary" onClick={() => updateServiceWorker(true)}>
          Mettre à jour
        </button>
        <button type="button" class="icon-btn" aria-label="Plus tard" onClick={() => setNeedRefresh(false)}>
          ✕
        </button>
      </div>
    )
  }
  if (offlineReady) {
    return (
      <div class="toast" role="status">
        <span>📴 Prêt à fonctionner hors ligne</span>
      </div>
    )
  }
  return null
}
