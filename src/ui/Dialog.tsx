import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, onClose, wide, children }: {
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return <dialog ref={ref} className={`dialog${wide ? ' dialog-wide' : ''}`} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <article className="dialog-body">
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button type="button" aria-label="Close" className="icon-button" onClick={onClose}><X size={20} /></button>
      </header>
      {children}
    </article>
  </dialog>
}
