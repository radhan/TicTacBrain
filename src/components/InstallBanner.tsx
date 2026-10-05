import { Download, Share, X } from 'lucide-preact'
import { useInstall } from '../lib/install'

const LOGO = `${import.meta.env.BASE_URL}icons/icon-192.png`

/** Invitation à installer l'app (bouton natif sur Android, guide sur iPhone). */
export function InstallBanner() {
  const { mode, dismissed, install, dismiss } = useInstall()
  if (!mode || dismissed) return null
  return (
    <section class="install" aria-label="Installer l'application">
      <img class="install-logo" src={LOGO} alt="" width="44" height="44" />
      <div class="install-text">
        <strong>Installe TicTacBrain</strong>
        {mode === 'prompt' ? (
          <span>Lance-la depuis ton écran d'accueil, en plein écran et même hors ligne.</span>
        ) : (
          <span>
            Touche <Share size={15} aria-label="Partager" class="inline-icon" /> <b>Partager</b>, puis{' '}
            <b>Sur l'écran d'accueil</b>.
          </span>
        )}
      </div>
      {mode === 'prompt' && (
        <button type="button" class="btn btn-primary btn-sm" onClick={install}>
          <Download size={16} aria-hidden="true" /> Installer
        </button>
      )}
      <button type="button" class="icon-btn icon-btn-ghost" aria-label="Plus tard" onClick={dismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
