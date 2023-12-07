export function preprocessor(code: string, replacements: Record<string, any>): string {
  const re = /\$<(?<key>[a-zA-Z0-9_]*)>/
  let array: RegExpExecArray | null = null
  while ((array = re.exec(code))) {
    const key = array.groups?.['key']
    if (key) {
      code = code.replace(re, replacements[key])
    }
  }
  return code
}

export function pad<T>(array: T[], length: number, value: T): T[] {
  if (array.length > length) return array.slice(0, length)
  return array.concat(new Array(length - array.length).fill(value))
}

// Rounds `n` to the least power of 2 greater than it.
export function pow2round(n: number): number {
  return 2 ** Math.ceil(Math.log2(n))
}

export async function readFromBuffer(buffer: GPUBuffer): Promise<Float32Array> {
  await buffer.mapAsync(GPUMapMode.READ)
  return new Float32Array(buffer.getMappedRange())
}
