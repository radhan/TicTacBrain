import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

/** Modale basée sur <dialog> : focus piégé, Échap et clic en dehors pour fermer. */
export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      class="modal"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div class="modal-body">
        <header class="modal-header">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
