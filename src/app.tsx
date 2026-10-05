import { CircleAlert, SearchX } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { UpdateToast } from './components/UpdateToast'
import { loadCatalog, resolvePool } from './lib/data'
import { goBack, useRoute } from './lib/router'
import { save } from './lib/storage'
import type { Catalog, TimerSetting } from './lib/types'
import { Home } from './screens/Home'
import { Quiz } from './screens/Quiz'
import { ThemeScreen } from './screens/ThemeScreen'

export function App() {
  const route = useRoute()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timer, setTimer] = useState<TimerSetting>(() => save.get().timer)

  useEffect(() => {
    loadCatalog().then(setCatalog, (e: Error) => setError(e.message))
  }, [])

  const onTimer = (t: TimerSetting) => {
    save.setTimer(t)
    setTimer(t)
  }

  return (
    <>
      {error ? (
        <main class="screen center">
          <span class="topic-chip topic-chip-lg">
            <CircleAlert size={26} aria-hidden="true" />
          </span>
          <h1 class="center-title">Chargement impossible</h1>
          <p>{error}</p>
          <button type="button" class="btn btn-secondary" onClick={() => location.reload()}>
            Réessayer
          </button>
        </main>
      ) : !catalog ? (
        <main class="screen center loading">Chargement…</main>
      ) : (
        <Screen catalog={catalog} route={route} timer={timer} onTimer={onTimer} />
      )}
      <UpdateToast hidden={route.name === 'play'} />
    </>
  )
}

function Screen({ catalog, route, timer, onTimer }: {
  catalog: Catalog
  route: ReturnType<typeof useRoute>
  timer: TimerSetting
  onTimer: (t: TimerSetting) => void
}) {
  if (route.name === 'theme') {
    const theme = catalog.themes.find((t) => t.id === route.themeId)
    if (theme) return <ThemeScreen theme={theme} timer={timer} onTimer={onTimer} />
    return <NotFound />
  }
  if (route.name === 'play') {
    const pool = resolvePool(catalog, route.pool)
    if (pool) return <Quiz key={`${pool.key}|${timer}`} pool={pool} timer={timer} />
    return <NotFound />
  }
  return <Home catalog={catalog} timer={timer} onTimer={onTimer} />
}

function NotFound() {
  return (
    <main class="screen center">
      <span class="topic-chip topic-chip-lg">
        <SearchX size={26} aria-hidden="true" />
      </span>
      <h1 class="center-title">Introuvable</h1>
      <p>Ce thème n'existe pas (ou plus).</p>
      <button type="button" class="btn btn-secondary" onClick={() => goBack('/')}>
        Retour à l'accueil
      </button>
    </main>
  )
}
