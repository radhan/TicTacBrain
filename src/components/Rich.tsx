import type { ComponentChildren } from 'preact'

/**
 * Markdown « léger » des questions, rendu sans HTML brut (pas d'injection possible) :
 *   `code`, **gras**, blocs ``` et retours à la ligne.
 */

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g

export function renderInline(text: string): ComponentChildren[] {
  return text.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return part
    return part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <strong key={i}>{part.slice(2, -2)}</strong>
  })
}

function renderLines(text: string): ComponentChildren[] {
  return text.split('\n').flatMap((line, i) => (i === 0 ? renderInline(line) : [<br key={`br${i}`} />, ...renderInline(line)]))
}

export function Rich({ text, class: className }: { text: string; class?: string }) {
  const blocks: ComponentChildren[] = []
  // Découpe en alternance texte / bloc de code.
  const segments = text.split(/```[\w+-]*\n?([\s\S]*?)```/g)
  segments.forEach((segment, i) => {
    if (i % 2 === 1) {
      blocks.push(
        <pre key={`pre${i}`}>
          <code>{segment.replace(/\n$/, '')}</code>
        </pre>,
      )
      return
    }
    segment
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p, j) => blocks.push(<p key={`p${i}-${j}`}>{renderLines(p)}</p>))
  })
  return <div class={className ? `rich ${className}` : 'rich'}>{blocks}</div>
}

/** Pour les réponses : une seule ligne, uniquement le `code` et le **gras**. */
export function Inline({ text }: { text: string }) {
  return <>{renderInline(text)}</>
}
