import constants from '../constants'
import { pad, preprocessor, readFromBuffer } from '../utils'
import type { ComputeBindings, ComputeBuffers, Solution } from './day'
import day0Code from '../shaders/day0.compute.wgsl?raw'

function parse(input: string): Float32Array {
  const data = input.split('\n').map(Number)
  const paddedSize = Math.ceil(data.length / constants.WORKGROUP_SIZE) * constants.WORKGROUP_SIZE
  const dataArray = Float32Array.from(pad(data, paddedSize, 0))
  return dataArray
}

function initComputeBuffers({
  device,
  data,
  numScratchpads = 0,
}: {
  device: GPUDevice
  data: Float32Array
  numScratchpads?: number
}): ComputeBuffers {
  // input data buffer
  const inputBuffer = device.createBuffer({
    label: 'Input buffer',
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  // blank buffer, output to be read from here
  const outputBuffer = device.createBuffer({
    label: 'Workgroup buffer',
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  })

  // scratchpad buffers of the size of the data
  const scratchpadBuffers = Array(numScratchpads)
    .fill(null)
    .map((_, i) =>
      device.createBuffer({
        label: `Scratchpad buffer (${i})`,
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE,
      }),
    )

  // JS can read this buffer
  const readBuffer = device.createBuffer({
    label: 'Read buffer',
    size: data.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  device.queue.writeBuffer(inputBuffer, 0, data)

  return {
    input: inputBuffer,
    output: outputBuffer,
    scratchpads: scratchpadBuffers,
    read: readBuffer,
  }
}

function initComputeBindings({ device, buffers }: { device: GPUDevice; buffers: ComputeBuffers }): ComputeBindings {
  const layout = device.createBindGroupLayout({
    label: 'Compute bind group layout',
    entries: [
      {
        binding: 0,
        buffer: { type: 'read-only-storage' },
        visibility: GPUShaderStage.COMPUTE,
      },
      {
        binding: 1,
        buffer: { type: 'storage' },
        visibility: GPUShaderStage.COMPUTE,
      },
    ],
  })

  const bindGroup = device.createBindGroup({
    label: 'Compute bind group',
    layout,
    entries: [
      {
        binding: 0,
        resource: { buffer: buffers.input, label: 'Input buffer' },
      },
      {
        binding: 1,
        resource: { buffer: buffers.output, label: 'Output buffer' },
      },
    ],
  })

  return {
    layout,
    bindGroup,
  }
}

function initComputeModule({ device, code }: { device: GPUDevice; code: string }): GPUShaderModule {
  return device.createShaderModule({
    label: 'Compute module',
    code,
  })
}

function initComputePipeline({
  device,
  module,
  bindings,
}: {
  device: GPUDevice
  module: GPUShaderModule
  bindings: ComputeBindings
}): GPUComputePipeline {
  const pipelineLayout = device.createPipelineLayout({
    label: 'Compute pipeline layout',
    bindGroupLayouts: [bindings.layout],
  })

  return device.createComputePipeline({
    label: 'Compute pipeline',
    layout: pipelineLayout,
    compute: {
      module,
      entryPoint: 'main',
    },
  })
}

function compute({
  device,
  buffers,
  bindings,
  pipeline,
  numWorkgroups,
}: {
  device: GPUDevice
  buffers: ComputeBuffers
  bindings: ComputeBindings
  pipeline: GPUComputePipeline
  numWorkgroups: number
}) {
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass({ label: 'Compute pass' })

  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindings.bindGroup)
  pass.dispatchWorkgroups(numWorkgroups, 1, 1)
  pass.end()

  // copy the output back to input + read
  encoder.copyBufferToBuffer(buffers.output, 0, buffers.read, 0, buffers.read.size)
  encoder.copyBufferToBuffer(buffers.output, 0, buffers.input, 0, buffers.input.size)
  encoder.clearBuffer(buffers.output)

  device.queue.submit([encoder.finish()])
}

const day0: Solution = async (device, input) => {
  const code = preprocessor(day0Code, constants)
  const data = parse(input)
  const buffers = initComputeBuffers({ device, data, numScratchpads: 0 })
  const module = initComputeModule({ device, code })
  const bindings = initComputeBindings({ device, buffers })
  const pipeline = initComputePipeline({ device, module, bindings })

  let elements = data.length
  while (elements > 1) {
    const numWorkgroups = Math.ceil(elements / constants.WORKGROUP_SIZE)
    compute({ device, bindings, buffers, pipeline, numWorkgroups })
    elements = numWorkgroups
  }

  const result = await readFromBuffer(buffers.read)
  return result[0]
}

export default day0
