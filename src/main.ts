import vertexCode from './shaders/vertex.wgsl?raw'
import fragmentCode from './shaders/fragment.wgsl?raw'

//#region Days of AoC

import day0Code from './shaders/day0.compute.wgsl?raw'

//#endregion

const constants = {
  WORKGROUP_SIZE: 4,
}

// stupid mesh + colors
const mesh = {
  vertices: [
    // first triangle
    [0, 0.8],
    [-0.8, 0],
    [0, -0.8],
    // second triangle
    [0, 0.8],
    [0.8, 0],
    [0, -0.8],
  ],
  colors: [
    // first triangle
    [0.807, 0.396, 0.231, 1],
    [0.49, 0.215, 0.258, 1],
    [0.168, 0.035, 0.282, 1],
    // second triangle
    [0.807, 0.396, 0.231, 1],
    [0.49, 0.215, 0.258, 1],
    [0.168, 0.035, 0.282, 1],
  ],
}

function preprocessor(code: string, replacements: Record<string, any>): string {
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

function pad<T>(array: T[], length: number, value: T): T[] {
  if (array.length > length) return array.slice(0, length)
  return array.concat(new Array(length - array.length).fill(value))
}

type VertexBuffers = Readonly<{
  buffers: GPUBuffer[]
  bufferLayouts: GPUVertexBufferLayout[]
}>
function initVertexBuffers({ device }: Readonly<{ device: GPUDevice }>): VertexBuffers {
  const vs = Float32Array.from(mesh.vertices.flat())
  const vb = device.createBuffer({
    label: 'Vertex buffer',
    size: vs.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })

  const vbLayout: GPUVertexBufferLayout = {
    arrayStride: vs.BYTES_PER_ELEMENT * 2,
    attributes: [{ format: 'float32x2', offset: 0, shaderLocation: 0 }],
  }

  device.queue.writeBuffer(vb, 0, vs)

  const colors = Float32Array.from(mesh.colors.flat())
  const colorBuffer = device.createBuffer({
    label: 'Color buffer',
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  const colorBufferLayout: GPUVertexBufferLayout = {
    arrayStride: colors.BYTES_PER_ELEMENT * 4,
    attributes: [{ format: 'float32x4', offset: 0, shaderLocation: 1 }],
  }

  device.queue.writeBuffer(colorBuffer, 0, colors)

  return {
    buffers: [vb, colorBuffer],
    bufferLayouts: [vbLayout, colorBufferLayout],
  }
}

type UniformBuffers = Readonly<{
  buffers: GPUBuffer[]
}>
function initUniformBuffers({ device }: Readonly<{ device: GPUDevice }>): UniformBuffers {
  const uTimeBuffer = device.createBuffer({
    label: 'uTime',
    size: 4, // 32 bit float
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  return {
    buffers: [uTimeBuffer],
  }
}

type Modules = Readonly<{ vertex: GPUShaderModule; fragment: GPUShaderModule }>
function initModules({ device }: Readonly<{ device: GPUDevice }>): Modules {
  const vertex = device.createShaderModule({
    label: 'Vertex shader',
    code: vertexCode,
  })

  const fragment = device.createShaderModule({
    label: 'Fragment shader',
    code: fragmentCode,
  })

  return {
    vertex,
    fragment,
  }
}

type BindGroup = Readonly<{ bindGroup: GPUBindGroup; layout: GPUBindGroupLayout }>
function initBindGroups({
  device,
  uniformBuffers,
}: Readonly<{ device: GPUDevice; uniformBuffers: UniformBuffers }>): BindGroup {
  const layout = device.createBindGroupLayout({
    label: 'Bind Group Layout',
    entries: uniformBuffers.buffers.map((_, binding) => ({ binding, visibility: GPUShaderStage.VERTEX, buffer: {} })),
  })

  const bindGroup = device.createBindGroup({
    label: 'Bind Group 0',
    layout,
    entries: uniformBuffers.buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
  })

  return {
    layout,
    bindGroup,
  }
}

function initPipelineLayout({
  device,
  bindGroup,
}: Readonly<{ device: GPUDevice; bindGroup: BindGroup }>): GPUPipelineLayout {
  return device.createPipelineLayout({
    label: 'Pipeline Layout',
    bindGroupLayouts: [bindGroup.layout],
  })
}

type Pipelines = Readonly<{ render: GPURenderPipeline; compute?: GPUComputePipeline }>
function initPipelines({
  device,
  format,
  modules,
  vertexBuffers,
  pipelineLayout,
}: Readonly<{
  device: GPUDevice
  format: GPUTextureFormat
  modules: Modules
  vertexBuffers: VertexBuffers
  pipelineLayout?: GPUPipelineLayout
}>): Pipelines {
  return {
    render: device.createRenderPipeline({
      label: 'Render pipeline',
      layout: pipelineLayout ?? 'auto',
      vertex: {
        module: modules.vertex,
        entryPoint: 'vs',
        buffers: vertexBuffers.bufferLayouts,
      },
      fragment: {
        module: modules.fragment,
        entryPoint: 'fs',
        targets: [{ format }],
      },
    }),
  }
}

function render(
  t: number,
  {
    device,
    view,
    vertexBuffers,
    uniformBuffers,
    renderPipeline,
    bindGroup,
  }: Readonly<{
    device: GPUDevice
    view: GPUTextureView
    vertexBuffers: VertexBuffers
    uniformBuffers: UniformBuffers
    renderPipeline: GPURenderPipeline
    bindGroup: BindGroup
  }>,
) {
  // set time
  device.queue.writeBuffer(uniformBuffers.buffers[0], 0, Float32Array.from([t]))

  const encoder = device.createCommandEncoder()
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view,
        loadOp: 'clear',
        clearValue: { r: 1, g: 1, b: 1, a: 1 },
        storeOp: 'store',
      },
    ],
  })

  renderPass.setPipeline(renderPipeline)
  renderPass.setBindGroup(0, bindGroup.bindGroup)
  vertexBuffers.buffers.forEach((buffer, location) => renderPass.setVertexBuffer(location, buffer))
  renderPass.draw(mesh.vertices.length, 1)
  renderPass.end()

  device.queue.submit([encoder.finish()])
}

type ComputeBuffers = {
  input: GPUBuffer // <- @binding(0)
  output: GPUBuffer // <- @binding(1)
  scratchpads: GPUBuffer[] // <- @binding(n + 2)
  read: GPUBuffer
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

type ComputeBindings = {
  bindGroup: GPUBindGroup
  layout: GPUBindGroupLayout
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

async function readFromBuffer({ buffers }: { buffers: ComputeBuffers }): Promise<Float32Array> {
  await buffers.read.mapAsync(GPUMapMode.READ)
  return new Float32Array(buffers.read.getMappedRange())
}

await (async function main() {
  const adapter = await navigator.gpu?.requestAdapter()
  const device = await adapter?.requestDevice()
  if (!device) throw new Error('No device')

  const canvas = document.getElementById('canvas')
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error('No canvas')
  const context = canvas.getContext('webgpu')
  if (!context) throw new Error('No context')
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format })

  const vertexBuffers = initVertexBuffers({ device })
  const modules = initModules({ device })
  const uniformBuffers = initUniformBuffers({ device })
  const bindGroup = initBindGroups({ device, uniformBuffers })
  const pipelineLayout = initPipelineLayout({ device, bindGroup })
  const pipelines = initPipelines({ device, format, modules, vertexBuffers, pipelineLayout })

  function rafCb(t: number) {
    if (!device) throw new Error('No device')
    if (!context) throw new Error('No context')
    const view = context.getCurrentTexture().createView()
    render(t, {
      device,
      view,
      vertexBuffers,
      uniformBuffers,
      renderPipeline: pipelines.render,
      bindGroup,
    })
    requestAnimationFrame(rafCb)
  }

  document.getElementById('run')?.addEventListener('click', async e => {
    e.stopPropagation()
    const start = performance.now()

    if (!device) throw new Error('No device')

    const code = preprocessor(day0Code, constants)

    const rawData = (document.getElementById('input') as HTMLTextAreaElement | undefined)?.value
    if (!rawData) throw new Error('Could not get data')
    // Try parse into numbers
    const data = rawData.split('\n').map(Number)
    const paddedSize = Math.ceil(data.length / constants.WORKGROUP_SIZE) * constants.WORKGROUP_SIZE
    const dataArray = Float32Array.from(pad(data, paddedSize, 0))

    const buffers = initComputeBuffers({ device, data: dataArray, numScratchpads: 0 })
    const module = initComputeModule({ device, code })
    const bindings = initComputeBindings({ device, buffers })
    const pipeline = initComputePipeline({ device, module, bindings })

    let elements = paddedSize
    while (elements > 1) {
      const numWorkgroups = Math.ceil(elements / constants.WORKGROUP_SIZE)
      compute({ device, bindings, buffers, pipeline, numWorkgroups })
      elements = numWorkgroups
    }

    const result = await readFromBuffer({ buffers })
    console.log(result)
    const end = performance.now()

    const output = document.getElementById('output') as HTMLInputElement
    if (output) {
      output.value = `${result[0]}`
    }

    const runtime = document.getElementById('runtime') as HTMLInputElement
    if (runtime) {
      runtime.value = `${(end - start).toFixed(2)}ms`
    }
  })

  requestAnimationFrame(rafCb)
})()
