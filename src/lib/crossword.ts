export type CrosswordWord = { word: string; clue: string }
export type PlacedWord = { word: string; clue: string; row: number; col: number; direction: 'across' | 'down'; number: number }
export type CrosswordResult = { placed: PlacedWord[]; unplaced: CrosswordWord[]; width: number; height: number }

const WORKING_SIZE = 30

export function generateCrossword(words: CrosswordWord[]): CrosswordResult {
  const clean = words
    .map(w => ({ word: w.word.trim().toUpperCase(), clue: w.clue.trim() }))
    .filter(w => w.word.length >= 2)
    .sort((a, b) => b.word.length - a.word.length)

  if (clean.length === 0) return { placed: [], unplaced: [], width: 0, height: 0 }

  const center = Math.floor(WORKING_SIZE / 2)
  const grid: (string | null)[][] = Array.from({ length: WORKING_SIZE }, () => Array(WORKING_SIZE).fill(null))
  const placed: PlacedWord[] = []
  const unplaced: CrosswordWord[] = []

  function inBounds(r: number, c: number) { return r >= 0 && r < WORKING_SIZE && c >= 0 && c < WORKING_SIZE }

  function canPlace(word: string, row: number, col: number, dir: 'across' | 'down'): boolean {
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'down' ? row + i : row
      const c = dir === 'across' ? col + i : col
      if (!inBounds(r, c)) return false
      const existing = grid[r][c]
      if (existing && existing !== word[i]) return false
      if (!existing) {
        if (dir === 'across') { if (grid[r - 1]?.[c] || grid[r + 1]?.[c]) return false }
        else { if (grid[r]?.[c - 1] || grid[r]?.[c + 1]) return false }
      }
    }
    const beforeR = dir === 'down' ? row - 1 : row
    const beforeC = dir === 'across' ? col - 1 : col
    const afterR = dir === 'down' ? row + word.length : row
    const afterC = dir === 'across' ? col + word.length : col
    if (inBounds(beforeR, beforeC) && grid[beforeR][beforeC]) return false
    if (inBounds(afterR, afterC) && grid[afterR][afterC]) return false
    return true
  }

  function place(word: string, row: number, col: number, dir: 'across' | 'down') {
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'down' ? row + i : row
      const c = dir === 'across' ? col + i : col
      grid[r][c] = word[i]
    }
  }

  const first = clean[0]
  place(first.word, center, center - Math.floor(first.word.length / 2), 'across')
  placed.push({ word: first.word, clue: first.clue, row: center, col: center - Math.floor(first.word.length / 2), direction: 'across', number: 0 })

  for (const entry of clean.slice(1)) {
    let best: { row: number; col: number; dir: 'across' | 'down'; intersections: number } | null = null
    for (const placedWord of placed) {
      for (let i = 0; i < entry.word.length; i++) {
        for (let j = 0; j < placedWord.word.length; j++) {
          if (entry.word[i] !== placedWord.word[j]) continue
          const dir: 'across' | 'down' = placedWord.direction === 'across' ? 'down' : 'across'
          const row = dir === 'down' ? placedWord.row - i : placedWord.row + j
          const col = dir === 'across' ? placedWord.col - i : placedWord.col + j
          if (!canPlace(entry.word, row, col, dir)) continue
          if (!best || best.intersections < 1) best = { row, col, dir, intersections: 1 }
        }
      }
    }
    if (!best) {
      const maxRow = Math.max(...placed.map(p => p.direction === 'down' ? p.row + p.word.length - 1 : p.row))
      const fallbackRow = maxRow + 2
      const fallbackCol = center - Math.floor(entry.word.length / 2)
      if (inBounds(fallbackRow, fallbackCol) && canPlace(entry.word, fallbackRow, fallbackCol, 'across')) {
        best = { row: fallbackRow, col: fallbackCol, dir: 'across', intersections: 0 }
      }
    }
    if (best) {
      place(entry.word, best.row, best.col, best.dir)
      placed.push({ word: entry.word, clue: entry.clue, row: best.row, col: best.col, direction: best.dir, number: 0 })
    } else {
      unplaced.push(entry)
    }
  }

  let minRow = WORKING_SIZE, maxRow = 0, minCol = WORKING_SIZE, maxCol = 0
  for (const p of placed) {
    const endRow = p.direction === 'down' ? p.row + p.word.length - 1 : p.row
    const endCol = p.direction === 'across' ? p.col + p.word.length - 1 : p.col
    minRow = Math.min(minRow, p.row); maxRow = Math.max(maxRow, endRow)
    minCol = Math.min(minCol, p.col); maxCol = Math.max(maxCol, endCol)
  }
  const normalized = placed.map(p => ({ ...p, row: p.row - minRow, col: p.col - minCol }))

  const startOrder = [...normalized].sort((a, b) => a.row - b.row || a.col - b.col)
  const numberByStart = new Map<string, number>()
  let nextNumber = 1
  for (const p of startOrder) {
    const key = `${p.row},${p.col}`
    if (!numberByStart.has(key)) numberByStart.set(key, nextNumber++)
  }
  for (const p of normalized) p.number = numberByStart.get(`${p.row},${p.col}`)!

  return { placed: normalized, unplaced, width: maxCol - minCol + 1, height: maxRow - minRow + 1 }
}
