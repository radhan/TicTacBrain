import { useEffect, useMemo, useState } from 'preact/hooks'

/**
 * Routage par hash (#/…) : fonctionne sur n'importe quel hébergement statique
 * (GitHub Pages compris) et hors ligne, sans configuration serveur.
 *
 *   #/                       → accueil
 *   #/t/<theme>              → choix du sous-thème
 *   #/play/all               → partie, tous les thèmes
 *   #/play/<theme>           → partie, tout un thème
 *   #/play/<theme>/<sous>    → partie, un sous-thème
 */
export type Route =
  | { name: 'home' }
  | { name: 'theme'; themeId: string }
  | { name: 'play'; pool: string }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 't' && parts[1]) return { name: 'theme', themeId: parts[1] }
  if (parts[0] === 'play' && parts[1]) return { name: 'play', pool: parts.slice(1, 3).join('/') }
  return { name: 'home' }
}

/**
 * Profondeur de l'entrée d'historique courante *dans l'app*, rangée dans
 * history.state : elle reste juste même après un « retour » du navigateur
 * ou du bouton Android, contrairement à un simple compteur.
 */
const depth = (): number => (history.state as { depth?: number } | null)?.depth ?? 0

const ROUTE_EVENT = 'tictacbrain:route'
const notify = () => window.dispatchEvent(new Event(ROUTE_EVENT))

export function navigate(path: string) {
  history.pushState({ depth: depth() + 1 }, '', `#${path}`)
  notify()
}

/** Revient à l'écran précédent de l'app, ou à `fallback` si on y est arrivé par un lien direct. */
export function goBack(fallback: string) {
  if (depth() > 0) {
    history.back()
  } else {
    history.replaceState({ depth: 0 }, '', `#${fallback}`)
    notify()
  }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    for (const type of ['popstate', 'hashchange', ROUTE_EVENT]) window.addEventListener(type, onChange)
    return () => {
      for (const type of ['popstate', 'hashchange', ROUTE_EVENT]) window.removeEventListener(type, onChange)
    }
  }, [])
  useEffect(() => window.scrollTo(0, 0), [hash])
  return useMemo(() => parseRoute(hash), [hash])
}
