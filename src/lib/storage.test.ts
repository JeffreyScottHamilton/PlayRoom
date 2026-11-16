import { afterEach, describe, expect, it, vi } from 'vitest'
import { readJSON, writeJSON } from './storage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('readJSON', () => {
  it('returns the fallback when the key is missing', () => {
    expect(readJSON('playroom:missing', ['x'])).toEqual(['x'])
  })

  it('returns the fallback when the stored value is bad JSON', () => {
    localStorage.setItem('playroom:bad', '{not json')
    expect(readJSON('playroom:bad', 42)).toBe(42)
  })

  it('returns the fallback when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readJSON('playroom:blocked', { a: 1 })).toEqual({ a: 1 })
  })

  it('returns the stored value when it is valid', () => {
    writeJSON('playroom:ok', ['a', 'b'])
    expect(readJSON('playroom:ok', [])).toEqual(['a', 'b'])
  })
})

describe('writeJSON', () => {
  it('never throws when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeJSON('playroom:quota', { big: true })).not.toThrow()
  })
})
