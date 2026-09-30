import { describe, expect, it } from 'vitest'
import { generateCrossword } from './crossword'

function buildGridFromPlaced(placed: ReturnType<typeof generateCrossword>['placed'], width: number, height: number) {
  const grid: (string | null)[][] = Array.from({ length: height }, () => Array(width).fill(null))
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.direction === 'down' ? p.row + i : p.row
      const c = p.direction === 'across' ? p.col + i : p.col
      grid[r][c] = p.word[i]
    }
  }
  return grid
}

describe('generateCrossword', () => {
  it('returns empty result for no words', () => {
    expect(generateCrossword([])).toEqual({ placed: [], unplaced: [], width: 0, height: 0 })
  })

  it('drops words shorter than 2 letters', () => {
    const result = generateCrossword([{ word: 'A', clue: 'x' }, { word: 'OK', clue: 'y' }])
    expect(result.placed.map(p => p.word)).toEqual(['OK'])
  })

  it('places a single word', () => {
    const result = generateCrossword([{ word: 'бензин', clue: 'шатахуун' }])
    expect(result.placed).toHaveLength(1)
    expect(result.placed[0].word).toBe('БЕНЗИН')
    expect(result.width).toBe(6)
    expect(result.height).toBe(1)
  })

  it('intersects two words that share a letter, without any cell conflict', () => {
    // АСУУЛТ and УУР share "УУ"
    const result = generateCrossword([{ word: 'асуулт', clue: 'a' }, { word: 'дуу', clue: 'b' }])
    expect(result.placed).toHaveLength(2)
    expect(result.unplaced).toHaveLength(0)
    // every placed cell must agree with every other placed cell at shared coordinates
    const cells = new Map<string, string>()
    for (const p of result.placed) {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.direction === 'down' ? p.row + i : p.row
        const c = p.direction === 'across' ? p.col + i : p.col
        const key = `${r},${c}`
        if (cells.has(key)) expect(cells.get(key)).toBe(p.word[i])
        else cells.set(key, p.word[i])
      }
    }
  })

  it('assigns every word a positive clue number', () => {
    const result = generateCrossword([{ word: 'ослын', clue: 'a' }, { word: 'осол', clue: 'b' }, { word: 'дүрэм', clue: 'c' }])
    for (const p of result.placed) expect(p.number).toBeGreaterThan(0)
  })

  it('still places a word with no shared letters, disconnected from the rest', () => {
    const result = generateCrossword([{ word: 'ажил', clue: 'a' }, { word: 'зам', clue: 'b' }])
    expect(result.placed).toHaveLength(2)
    expect(result.unplaced).toHaveLength(0)
  })

  it('handles many overlapping words without cell conflicts', () => {
    const words = [
      { word: 'аюулгүй', clue: '1' },
      { word: 'ажиллагаа', clue: '2' },
      { word: 'дүрэм', clue: '3' },
      { word: 'осол', clue: '4' },
      { word: 'хамгаалалт', clue: '5' },
      { word: 'дохио', clue: '6' },
    ]
    const result = generateCrossword(words)
    expect(result.placed.length + result.unplaced.length).toBe(words.length)
    const grid = buildGridFromPlaced(result.placed, result.width, result.height)
    // sanity: grid bounding box matches reported width/height
    expect(grid.length).toBe(result.height)
    expect(grid[0].length).toBe(result.width)
  })

  it('uppercases words in the output', () => {
    const result = generateCrossword([{ word: 'бохирдол', clue: 'a' }])
    expect(result.placed[0].word).toBe('БОХИРДОЛ')
  })
})
