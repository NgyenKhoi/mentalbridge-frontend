type Props = Readonly<{ text: string }>

// Preserve authored paragraphs. Only explicit newline bullet markers become lists.
export default function SupportPlanDescription({ text }: Props) {
  const blocks: Array<{ kind: 'paragraph' | 'list'; lines: string[] }> = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const bullet = /^(?:[-*•])\s+(.+)$/.exec(line)
    const kind = bullet ? 'list' : 'paragraph'
    const previous = blocks.at(-1)
    if (previous?.kind === kind) previous.lines.push(bullet?.[1] ?? line)
    else blocks.push({ kind, lines: [bullet?.[1] ?? line] })
  }
  return (
    <div className="support-plan-description">
      {blocks.map((block, index) =>
        block.kind === 'list' ? (
          <ul key={index}>
            {block.lines.map((line, item) => (
              <li key={item}>{line}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.lines.join(' ')}</p>
        ),
      )}
    </div>
  )
}
