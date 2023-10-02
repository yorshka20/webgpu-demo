export async function createWebGPU() {
  // check if webgpu is supported by env
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported on this browser.');
  }

  console.log('gpu', navigator.gpu);

  // first, request an adapter
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No appropriate GPUAdapter found.');
  }

  console.log('adapter', adapter);

  // second, request device
  const device = await adapter.requestDevice();
  if (!adapter) {
    throw new Error('No GPU device found.');
  }

  console.log('device', device);

  // get canvas format for texture.
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  return {
    device,
    adapter,
    canvasFormat,
  };
}
