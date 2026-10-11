import { describe, expect, it } from 'vitest'
import { POINTS_PER_ITEM, maxScoreFor, parseBulkLines, pickCrosswordWords, pickRandom, playCountOf, poolOf } from './game-sampling'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

describe('playCountOf', () => {
  it('defaults to the whole pool and never exceeds it', () => {
    expect(playCountOf({}, 40)).toBe(40)
    expect(playCountOf({ play_count: null }, 40)).toBe(40)
    expect(playCountOf({ play_count: 15 }, 40)).toBe(15)
    expect(playCountOf({ play_count: 99 }, 40)).toBe(40)
    expect(playCountOf({ play_count: 0 }, 40)).toBe(40)
    expect(playCountOf({ play_count: 7.9 }, 40)).toBe(7)
  })
})

describe('pickRandom', () => {
  const pool = Array.from({ length: 40 }, (_, i) => i)
  it('returns the requested number of distinct items without touching the input', () => {
    const picked = pickRandom(pool, 15)
    expect(picked).toHaveLength(15)
    expect(new Set(picked).size).toBe(15)
    expect(pool).toHaveLength(40)
    expect(pool[0]).toBe(0)
  })
  it('gives different selections and orders', () => {
    const a = pickRandom(pool, 15, seeded(1)), b = pickRandom(pool, 15, seeded(2))
    expect(a).not.toEqual(b)
  })
  it('over many draws every item gets picked', () => {
    const seen = new Set<number>()
    const rng = seeded(7)
    for (let i = 0; i < 200; i++) pickRandom(pool, 15, rng).forEach(item => seen.add(item))
    expect(seen.size).toBe(40)
  })
  it('handles counts larger than the pool and zero', () => {
    expect(pickRandom([1, 2, 3], 10)).toHaveLength(3)
    expect(pickRandom([1, 2, 3], 0)).toEqual([])
  })
})

describe('maxScoreFor', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ statement: `s${i}`, answer: true }))
  it('scores a fixed number of points per shown item', () => {
    expect(maxScoreFor('truth_false', { items })).toBe(40 * POINTS_PER_ITEM)
    expect(maxScoreFor('truth_false', { items, play_count: 15 })).toBe(15 * POINTS_PER_ITEM)
    expect(maxScoreFor('match', { pairs: items.slice(0, 5), play_count: 15 })).toBe(5 * POINTS_PER_ITEM)
  })
  it('caps a crossword sample at the number of words drawn', () => {
    const words = ['МАШИН', 'ЗАМ', 'БҮС', 'ХУРД', 'ЗОГСОЛТ', 'ГЭРЭЛ', 'ЖОЛООЧ', 'ШИРЭЭ'].map(word => ({ word, clue: word.toLowerCase() }))
    expect(maxScoreFor('word_grid', { words, play_count: 4 })).toBe(4 * POINTS_PER_ITEM)
    expect(poolOf('word_grid', { words })).toHaveLength(8)
  })
})

describe('pickCrosswordWords', () => {
  it('returns the whole list when everything is wanted', () => {
    const words = [{ word: 'ЗАМ', clue: 'a' }, { word: 'МАШИН', clue: 'b' }]
    expect(pickCrosswordWords(words, 5)).toBe(words)
  })
})

describe('parseBulkLines', () => {
  it('parses true/false lines and skips malformed ones', () => {
    expect(parseBulkLines('truth_false', 'Бүс зүүх ёстой | үнэн\nДутуу мөр\n\nХурд хэтрүүлж болно | худал')).toEqual([
      { statement: 'Бүс зүүх ёстой', answer: true }, { statement: 'Хурд хэтрүүлж болно', answer: false },
    ])
  })
  it('parses match, word grid and multiple choice', () => {
    expect(parseBulkLines('match', 'Дүрэм | Тайлбар')).toEqual([{ left: 'Дүрэм', right: 'Тайлбар' }])
    expect(parseBulkLines('word_grid', 'зам | Машин явдаг\nа | богино')).toEqual([{ left: 'ЗАМ', right: 'Машин явдаг' }])
    expect(parseBulkLines('random_box', 'Хурд? | 40 | 60 | 90 | 2')).toEqual([{ prompt: 'Хурд?', options: ['40', '60', '90'], correct_index: 1 }])
    expect(parseBulkLines('random_box', 'Хурд? | 40 | 60 | 90 | 9')).toEqual([])
  })
})
