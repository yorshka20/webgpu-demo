import { WORKGROUP_SIZE } from '../constants';

export function createVertices(device: GPUDevice) {
  /**
   * * The GPU cannot draw vertices with data from a JavaScript array.
   * * GPUs frequently have their own memory that is highly optimized for rendering,
   * * and so any data you want the GPU to use while it draws needs to be placed in that memory.
   */

  // To form the square from the diagram, you have to list the (-0.8, -0.8) and (0.8, 0.8) vertices twice

  /**
   * * You don't have to repeat the vertex data in order to make triangles. Using something called Index Buffers,
   * * you can feed a separate list of values to the GPU that tells it what vertices to connect together into triangles so that they don't need to be duplicated.
   */

  // prettier-ignore
  const vertices = new Float32Array([
  //   X,    Y,
    -0.8, -0.8, // Triangle 1 (Blue)
     0.8, -0.8,
     0.8,  0.8, // repeat

    -0.8, -0.8, // Triangle 2 (Red)
     0.8,  0.8,
    -0.8,  0.8,
  ]);

  // Buffer cannot be changed after created. you can only change the content by calling `writeBuffer()`
  const vertexBuffer = device.createBuffer({
    label: 'Cell vertices', // Every single WebGPU object you create can be given an optional label for errors indicating
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

  // create bufferLayout for vertex
  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 8, // for every 2 float32
    attributes: [
      {
        format: 'float32x2',
        offset: 0,
        // This is an arbitrary number between 0 and 15 and must be unique for every attribute that you define
        shaderLocation: 0, // Position, see vertex shader
      },
    ],
  };
  return {
    vertices,
    vertexBuffer,
    vertexBufferLayout,
  };
}

export function createShaders(device: GPUDevice) {
  // vertex shader -> fragment shader -> done.

  /**
   * 1. vertex shaders will be called for every vertex.
   * 2. fragment shaders will be called for every drawn pixel.
   * 3. fragment shaders are always called after vertex shaders.
   * 4. WGSL need a ';' after each expression.
   * 5. vertex fn will be called in parallel and randomly. never expect it to be called in sequential order.
   * 6. in WGSL, 'let' means 'const' while 'var' means 'let' in javascript.
   * 7. you can create separate shaders for vertex and fragment.
   * 8. you can have multiple fns in one shader.
   */
  const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: `
      // Your shader code will go here

      struct VertexInput {
        @location(0) pos: vec2f,
        @builtin(instance_index) instance: u32,
      };

      struct VertexOutput {
        @builtin(position) pos: vec4f,
        @location(0) cell: vec2f,
      };


      // defined an uniform for GRID_SIZE in drawGrid.ts
      @group(0) @binding(0) var<uniform> grid: vec2f;
      // add storage buffer to cell states.
      @group(0) @binding(1) var<storage> cellState: array<u32>;

      @vertex
      fn vertexMain(input: VertexInput) -> VertexOutput {

        let i = f32(input.instance); // Save the instance_index as a float

        let state = f32(cellState[input.instance]); // query cellState in storageBuffer

        // Compute the cell coordinate from the instance_index
        let cell = vec2f(i % grid.x, floor(i / grid.x));

        let cellOffset = cell / grid * 2; // Compute the offset to cell

        // state = 0 or 1.
        // scale with state can change the cell state to 'on' or 'off'
        let gridPos = (input.pos * state + 1) / grid - 1 + cellOffset;

        var output: VertexOutput;
        output.pos = vec4f(gridPos, 0, 1);
        output.cell = cell;
        return output;
      }


      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
        // Remember, fragment return values are (Red, Green, Blue, Alpha)
        // and since cell is a 2D vector, this is equivalent to:
        // (Red = cell.x, Green = cell.y, Blue = 0, Alpha = 1)

        let c = input.cell / grid;

        // return vec4f(c, 1-c.x*c.y, 1);
        return vec4f(c, 1-c.x, 1);
      }
    `,
  });

  return {
    cellShaderModule,
  };
}

export function createComputeShader(device: GPUDevice) {
  /**
   * 1. The cell.xy syntax here is a shorthand known as swizzling.
   *    It's equivalent to saying vec2(cell.x, cell.y)
   *
   *
   */

  // Create the compute shader that will process the simulation.
  const simulationShaderModule = device.createShaderModule({
    label: 'Game of Life simulation shader',
    code: `
    @group(0) @binding(0) var<uniform> grid: vec2f;

    // var<storage> is read-only while var<storage, read_write> can write.
    @group(0) @binding(1) var<storage> cellStateIn: array<u32>;
    @group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

    fn cellIndex(cell: vec2u) -> u32 {
      return (cell.y % u32(grid.y)) * u32(grid.x) + (cell.x % u32(grid.x));
    }

    fn cellActive(x: u32, y: u32) -> u32 {
      return cellStateIn[cellIndex(vec2(x, y))];
    }

    @compute
    @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
    fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
      // Determine how many active neighbors this cell has.
      let activeNeighbors = cellActive(cell.x+1, cell.y+1) +
                            cellActive(cell.x+1, cell.y) +
                            cellActive(cell.x+1, cell.y-1) +
                            cellActive(cell.x, cell.y-1) +
                            cellActive(cell.x-1, cell.y-1) +
                            cellActive(cell.x-1, cell.y) +
                            cellActive(cell.x-1, cell.y+1) +
                            cellActive(cell.x, cell.y+1);

      let i = cellIndex(cell.xy);

      // Conway's game of life rules:
      switch activeNeighbors {
        case 2: {
          cellStateOut[i] = cellStateIn[i];
        }
        case 3: {
          cellStateOut[i] = 1;
        }
        default: {
          cellStateOut[i] = 0;
        }
      }
    }`,
  });

  return { simulationShaderModule };
}

export function createRenderPipeline(
  device: GPUDevice,
  canvasFormat: GPUTextureFormat,
  vertexBufferLayout: GPUVertexBufferLayout,
  cellShaderModule: GPUShaderModule,
  bindGroupLayout: GPUBindGroupLayout,
) {
  const pipelineLayout = device.createPipelineLayout({
    label: 'Cell Pipeline Layout',
    // bindGroupLayout should be placed according to its index.
    // e.g.bindGroup(0) should be the first layout
    bindGroupLayouts: [bindGroupLayout],
  });

  // create render pipeline
  const cellPipeline = device.createRenderPipeline({
    label: 'Cell pipeline',
    layout: pipelineLayout,
    vertex: {
      module: cellShaderModule,
      entryPoint: 'vertexMain',
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: 'fragmentMain',
      targets: [
        {
          format: canvasFormat,
        },
      ],
    },
  });

  return {
    cellPipeline,
    pipelineLayout,
  };
}

export function createComputePipeline(
  device: GPUDevice,
  pipelineLayout: GPUPipelineLayout,
  simulationShaderModule: GPUShaderModule,
) {
  // Create a compute pipeline that updates the game state.
  const simulationPipeline = device.createComputePipeline({
    label: 'Simulation pipeline',
    layout: pipelineLayout,
    compute: {
      module: simulationShaderModule,
      entryPoint: 'computeMain',
    },
  });

  return { simulationPipeline };
}
