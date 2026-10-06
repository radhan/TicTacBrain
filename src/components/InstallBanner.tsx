import { Download, EllipsisVertical, Share, X } from 'lucide-preact'
import { useInstall } from '../lib/install'

const LOGO = `${import.meta.env.BASE_URL}icons/icon-192.png`

/** Invitation à installer l'app, adaptée au navigateur. */
export function InstallBanner() {
  const { mode, dismissed, install, dismiss } = useInstall()
  if (!mode || dismissed) return null
  return (
    <section class="install" aria-label="Installer l'application">
      <img class="install-logo" src={LOGO} alt="" width="44" height="44" />
      <div class="install-text">
        <strong>Garde la bombe dans ta poche</strong>
        {mode === 'prompt' && <span>Installe l'app : plein écran, lancement depuis l'accueil, et même hors connexion.</span>}
        {mode === 'ios' && (
          <span>
            Dans Safari, touche <Share size={15} aria-label="Partager" class="inline-icon" /> <b>Partager</b>, puis{' '}
            <b>Sur l'écran d'accueil</b>.
          </span>
        )}
        {mode === 'android-menu' && (
          <span>
            Ouvre le menu <EllipsisVertical size={15} aria-label="du navigateur" class="inline-icon" /> du navigateur, puis{' '}
            <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>).
          </span>
        )}
        {mode === 'inapp' && (
          <span>
            Ouvre d'abord cette page dans <b>Safari</b> ou <b>Chrome</b> (menu de l'app → « Ouvrir dans le navigateur »).
          </span>
        )}
      </div>
      <button type="button" class="icon-btn icon-btn-ghost install-close" aria-label="Plus tard" onClick={dismiss}>
        <X size={18} aria-hidden="true" />
      </button>
      {mode === 'prompt' && (
        <button type="button" class="btn btn-primary install-cta" onClick={install}>
          <Download size={18} aria-hidden="true" /> Installer l'application
        </button>
      )}
    </section>
  )
}
