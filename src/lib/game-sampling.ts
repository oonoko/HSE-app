import { generateCrossword } from '@/lib/crossword'

export const POINTS_PER_ITEM = 100

type GameContent = { items?: unknown[]; pairs?: unknown[]; words?: Array<{ word: string; clue: string }>; play_count?: number | null }

export function poolOf(template: string, content: GameContent): unknown[] {
  if (template === 'word_grid') return content.words ?? []
  return (template === 'match' ? content.pairs : content.items) ?? []
}

// How many items one play shows. Unset (or at least the pool size) means the whole pool.
export function playCountOf(content: GameContent, poolSize: number): number {
  const wanted = Math.floor(Number(content.play_count))
  if (!Number.isFinite(wanted) || wanted < 1) return poolSize
  return Math.min(wanted, poolSize)
}

export function pickRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.max(0, count))
}

// The highest score one play can reach; the server uses it to clamp what the client reports.
export function maxScoreFor(template: string, content: GameContent): number {
  const pool = poolOf(template, content)
  const count = playCountOf(content, pool.length)
  if (template === 'word_grid' && count >= pool.length) return generateCrossword(content.words ?? []).placed.length * POINTS_PER_ITEM
  return count * POINTS_PER_ITEM
}

// A random subset of crossword words may not interlock well, so draw a few candidates and keep the one that places the most.
export function pickCrosswordWords(words: Array<{ word: string; clue: string }>, count: number, tries = 6, random: () => number = Math.random) {
  if (count >= words.length) return words
  let best = pickRandom(words, count, random)
  let bestPlaced = generateCrossword(best).placed.length
  for (let i = 1; i < tries && bestPlaced < count; i++) {
    const candidate = pickRandom(words, count, random)
    const placed = generateCrossword(candidate).placed.length
    if (placed > bestPlaced) { best = candidate; bestPlaced = placed }
  }
  return best
}

// Parses "one item per line" bulk input for the admin builder.
export function parseBulkLines(template: string, text: string): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('|').map(part => part.trim())
    if (template === 'truth_false') {
      const verdict = (parts[1] ?? '').toLowerCase()
      const truthy = ['үнэн', 'true', 'y', 'yes', 'т', '1'].includes(verdict)
      const falsy = ['худал', 'false', 'n', 'no', 'х', '0'].includes(verdict)
      if (parts[0] && (truthy || falsy)) rows.push({ statement: parts[0], answer: truthy })
    } else if (template === 'match') {
      if (parts[0] && parts[1]) rows.push({ left: parts[0], right: parts[1] })
    } else if (template === 'word_grid') {
      if (parts[0] && parts[0].length >= 2 && parts[1]) rows.push({ left: parts[0].toUpperCase(), right: parts[1] })
    } else {
      const marker = (parts[4] ?? '').toLowerCase()
      const index = /^[123]$/.test(marker) ? Number(marker) - 1 : 'abc'.indexOf(marker)
      if (parts[0] && parts[1] && parts[2] && parts[3] && marker && index >= 0 && index <= 2) rows.push({ prompt: parts[0], options: [parts[1], parts[2], parts[3]], correct_index: index })
    }
  }
  return rows
}

export const BULK_FORMATS: Record<string, string> = {
  truth_false: 'Өгүүлбэр | үнэн\nӨөр өгүүлбэр | худал',
  match: 'Дүрэм | Тайлбар',
  word_grid: 'ҮГ | Тодорхойлолт',
  random_box: 'Асуулт | Хариулт 1 | Хариулт 2 | Хариулт 3 | зөв нь (1, 2 эсвэл 3)',
}
