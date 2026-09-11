import '../src/loadEnv.js';

const { createApp } = await import('../src/app.js');
export const config = {
  maxDuration: 10,
  regions: ['syd1'],
};
export default createApp();
