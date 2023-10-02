import { useEffect, useRef, useState } from 'react';

import './App.css';
import { GRID_SIZE, WORKGROUP_SIZE, setGridSize } from './constants';
import { useWebGPU } from './hooks';
import {
  createComputePipeline,
  createComputeShader,
  createRenderPipeline,
  createShaders,
  createVertices,
} from './render/geometry';
import { createBindGroup } from './render/grid';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState(512);

  useEffect(() => {
    const { clientHeight } = document.documentElement;
    const s = clientHeight - 10;
    setSize(s);
    setGridSize(Math.pow(s / 30, 2));
  }, []);

  const { device, context } = useWebGPU();

  useEffect(() => {
    if (!device || !context) return;

    main(device, context);

    return () => {
      device.destroy();
    };
  }, [device, context]);

  return (
    <>
      <canvas ref={canvasRef} id="canvas" width={size} height={size}></canvas>
    </>
  );
}

let step = 0; // Track how many simulation steps have been run

async function main(device: GPUDevice, context: GPUCanvasContext) {
  // 1. create webGPU device and context.

  // 2. create vertex
  const { vertices, vertexBuffer, vertexBufferLayout } = createVertices(device);

  // 3. create vertex and fragment shaders
  const { cellShaderModule } = createShaders(device);

  // 4. create computeShaders for simulations
  const { simulationShaderModule } = createComputeShader(device);

  // 5. create bindGroups and layout
  const { bindGroups, bindGroupLayout } = createBindGroup(device);

  // 6. build up renderPipeline and other buffers.
  // get canvas format for texture.
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  const { cellPipeline, pipelineLayout } = createRenderPipeline(
    device,
    canvasFormat,
    vertexBufferLayout,
    cellShaderModule,
    bindGroupLayout,
  );

  // 7. create simulation pipeline
  const { simulationPipeline } = createComputePipeline(
    device,
    pipelineLayout,
    simulationShaderModule,
  );

  // 8. configure context and ready for rendering
  context.configure({
    device: device,
    format: canvasFormat, // this configures the texture format used in webgpu
    alphaMode: 'premultiplied',
  });

  function render() {
    const encoder = device.createCommandEncoder();

    /**
     * start compute shaders computing.
     *
     * this will compute the simulation result and save it to
     * storage buffer for rendering data query
     */
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(simulationPipeline);
    // switch between two bindGroups
    computePass.setBindGroup(0, bindGroups[step % 2]);

    // set up concurrent computing groups
    const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

    computePass.end();

    step++; // Increment the step count

    /**
     ** render commands should be between `encoder.beginRenderPass` and `pass.end`
     */

    /**
     * start a render process.
     *
     * this will encode the render commands into what gpu can understand.
     *
     * after commands being encoded, send the commands to device to process.
     */
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear', // this will clear the screen every time onload
          clearValue: { r: 0, g: 0, b: 0.4, a: 1 }, // or [0, 0, 0.4, 1]
          storeOp: 'store', // save to screen
        },
      ],
    });

    // start recoding the render pass commands

    // 1. setup pipeline
    pass.setPipeline(cellPipeline);
    // 2. setup vertex buffer
    pass.setVertexBuffer(0, vertexBuffer);
    // 3. setup bindGroup for shaders. switch between 2 bindGroups.
    pass.setBindGroup(/* @group(0) index */ 0, bindGroups[step % 2]);
    // 4. draw vertex instances
    pass.draw(vertices.length / 2, /* instanceCount */ GRID_SIZE * GRID_SIZE); // draw 6 vertices for `instanceCount` times

    // stop recording the render pass commands
    pass.end();

    // generate the commandBuffer
    const commandBuffer = encoder.finish();
    // submit to rendering queue to start working.
    device.queue.submit([commandBuffer]);

    // repeated calling render function in every frame.
    // you can setup a FPS limit by using`setInterval`
    requestAnimationFrame(render);
  }

  // 9. star rendering!
  requestAnimationFrame(render);
}

export default App;
