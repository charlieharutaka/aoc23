import vertexCode from './shaders/vertex.wgsl?raw'
import fragmentCode from './shaders/fragment.wgsl?raw'

//#region Days of AoC

import day0Code from './shaders/day0.compute.wgsl?raw'

//#endregion

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

  requestAnimationFrame(rafCb)
})()
