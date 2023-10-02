import { useEffect, useState } from 'react';

export function useWebGPU() {
  const [device, setDevice] = useState<GPUDevice>();

  const [context, setContext] = useState<GPUCanvasContext>();

  useEffect(() => {
    // check if webgpu is supported by env
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser.');
    }

    console.log('gpu', navigator.gpu);

    async function createWebGPU() {
      // by using querySelector you can get a type guarantee for returned element.
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        return;
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

      setContext(context);

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

      setDevice(device);

      console.log('device', device);
    }

    createWebGPU();
  }, []);

  return { device, context };
}
