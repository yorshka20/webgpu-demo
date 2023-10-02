import { useEffect } from 'react';

import './App.css';
import { createWebGPU } from './render/create-web-gpu';
import {
  WORKGROUP_SIZE,
  beginRenderPass,
  createComputePipeline,
  createComputeShader,
  createRenderPipeline,
  createShaders,
  createVertices,
} from './render/geometry';
import { GRID_SIZE, createBindGroup } from './render/grid';

function App() {
  useEffect(() => {
    main();
  }, []);

  return (
    <>
      <canvas id="canvas" width="512" height="512"></canvas>
    </>
  );
}

const UPDATE_INTERVAL = 200; // Update every 200ms (5 times/sec)
let step = 0; // Track how many simulation steps have been run

async function main() {
  // by using querySelector you can get a type guarantee for returned element.
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    throw new Error('canvas not found.');
  }

  /**
   * To do this, first request a GPUCanvasContext from the canvas by calling canvas.getContext("webgpu").
   * (This is the same call that you'd use to initialize Canvas 2D or WebGL contexts,
   * using the 2d and webgl context types, respectively.)
   * The context that it returns must then be associated with the device using the configure() method
   */
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('WebGPU context is not created.');
  }

  // 1. create webGPU adapter and device
  const { device, canvasFormat } = await createWebGPU();

  // 2. create vertex
  const { vertices, vertexBuffer, vertexBufferLayout } = createVertices(device);

  // 3. create vertex and fragment shaders

  const { cellShaderModule } = createShaders(device);

  const { simulationShaderModule } = createComputeShader(device);

  // 5. create bindGroup with uniform
  const { bindGroups, bindGroupLayout } = createBindGroup(device);

  // 4. build up renderPipeline and other buffers.
  const { cellPipeline, pipelineLayout } = createRenderPipeline(
    device,
    canvasFormat,
    vertexBufferLayout,
    cellShaderModule,
    bindGroupLayout,
  );

  const { simulationPipeline } = createComputePipeline(
    device,
    pipelineLayout,
    simulationShaderModule,
  );

  // between `encoder.beginRenderPass` and `pass.end`
  function renderPassCommands(configuredContext: GPUCanvasContext) {
    function updateGrid() {
      const encoder = device.createCommandEncoder();
      const computePass = encoder.beginComputePass();

      // compute work
      computePass.setPipeline(simulationPipeline);
      computePass.setBindGroup(0, bindGroups[step % 2]);

      // New lines
      const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
      computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

      computePass.end();

      step++; // Increment the step count

      // start a render process.
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: configuredContext.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0.4, a: 1 }, // or [0, 0, 0.4, 1]
            storeOp: 'store',
          },
        ],
      });

      // draw the grid

      pass.setPipeline(cellPipeline);

      pass.setVertexBuffer(0, vertexBuffer);

      pass.setBindGroup(/* @group(0) index */ 0, bindGroups[step % 2]); // Updated!

      pass.draw(vertices.length / 2, /* instanceCount */ GRID_SIZE * GRID_SIZE); // draw 6 vertices for `instanceCount` times

      pass.end();

      device.queue.submit([encoder.finish()]);
    }

    // Schedule updateGrid() to run repeatedly
    setInterval(updateGrid, UPDATE_INTERVAL);
  }

  beginRenderPass(
    device,
    context,
    canvasFormat,
    renderPassCommands, // inject render commands
  );
}

export default App;
