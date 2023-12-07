import { pad, pow2round } from '../utils'
// import type { Solution } from './day'

/**
 * Example input:
 * 1abc2
 * pqr3stu8vwx
 * a1b2c3d4e5f
 * treb7uchet
 */

class Uint32Matrix {
  data: Uint32Array
  width: number
  height: number

  constructor(data: number[][]) {
    this.width = data.reduce((acc, arr) => (acc > arr.length ? acc : arr.length), 0)
    this.height = data.length
    this.data = new Uint32Array(this.width * this.height)
    for (let i = 0; i < data.length; i++) {
      this.data.set(data[i], i * this.width)
    }
  }
}

// Parse input: string -> Uint32Matrix
function parse(input: string): Uint32Matrix {
  const encoder = new TextEncoder()
  return new Uint32Matrix(
    input
      .split('\n')
      .map(s => Array.from(encoder.encode(s)))
      .map(s => pad(s, pow2round(s.length), 0)),
  )
}

parse('')
