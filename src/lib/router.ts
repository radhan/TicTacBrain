import { useEffect, useState } from 'preact/hooks'

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

/** Nombre d'entrées d'historique créées par l'app (pour savoir si « retour » reste dans l'app). */
let depth = 0

export function navigate(path: string) {
  depth += 1
  location.hash = path
}

/** Revient à l'écran précédent de l'app, ou à `fallback` si on y est arrivé par un lien direct. */
export function goBack(fallback: string) {
  if (depth > 0) {
    depth -= 1
    history.back()
  } else {
    location.replace(`#${fallback}`)
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
