export type WebGPUArray = Float32Array | Int32Array | Uint32Array

export type Solution = (device: GPUDevice, input: string) => Promise<number>

export type ComputeBuffers = {
  input: GPUBuffer // <- @binding(0)
  output: GPUBuffer // <- @binding(1)
  scratchpads: GPUBuffer[] // <- @binding(n + 2)
  read: GPUBuffer
}

export type ComputeBindings = {
  bindGroup: GPUBindGroup
  layout: GPUBindGroupLayout
}
