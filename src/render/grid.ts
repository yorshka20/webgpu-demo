import { GRID_SIZE } from '../constants';

export function createBindGroup(device: GPUDevice) {
  // Create a uniform buffer that describes the grid.
  // Uint32Array is also acceptable.
  const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
  const uniformBuffer = device.createBuffer({
    label: 'Grid Uniforms',
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, /*bufferOffset=*/ 0, uniformArray);

  // create storageBuffer for cellState query.
  const { cellStateStorage } = createStorageBuffer(device);

  // Create the bind group layout and pipeline layout.
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'Cell Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility:
          GPUShaderStage.VERTEX |
          GPUShaderStage.COMPUTE |
          GPUShaderStage.FRAGMENT, // ! this is where the tutorial gets wrong.
        buffer: {}, // Grid uniform buffer
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }, // Cell state input buffer
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }, // Cell state output buffer
      },
    ],
  });

  const bindGroups = [
    device.createBindGroup({
      label: 'Cell renderer bind group A',
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[0] },
        },
        {
          binding: 2,
          resource: { buffer: cellStateStorage[1] },
        },
      ],
    }),
    device.createBindGroup({
      label: 'Cell renderer bind group B',
      layout: bindGroupLayout,

      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[1] },
        },
        {
          binding: 2,
          resource: { buffer: cellStateStorage[0] },
        },
      ],
    }),
  ];

  return { bindGroups, bindGroupLayout };
}

export function createStorageBuffer(device: GPUDevice) {
  // Create an array representing the active state of each cell.
  const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

  // Create two storage buffers to hold the cell state.
  // it's called the `ping-pong` buffer pattern
  const cellStateStorage = [
    device.createBuffer({
      label: 'Cell State A',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: 'Cell State B',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
  ];

  // Mark every third cell of the first grid as active.
  for (let i = 0; i < cellStateArray.length; i += 3) {
    cellStateArray[i] = 1;
  }
  device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

  // Mark every other cell of the second grid as active.
  for (let i = 0; i < cellStateArray.length; ++i) {
    cellStateArray[i] = Math.random() > 0.8 ? 1 : 0;
  }
  device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

  // we will update the storageBuffer twice to make sure the update occurred step by step.

  return { cellStateStorage };
}
