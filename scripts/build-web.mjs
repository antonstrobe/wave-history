import { buildRenderer } from './build-renderer.mjs';
import { copyFile } from 'node:fs/promises';
await buildRenderer('web-dist');
for (const file of ['example.html', 'example.js', 'site-card.js']) await copyFile(`web/${file}`, `web-dist/${file}`);
await copyFile('web/preview.png', 'web-dist/preview.png').catch(error => { if (error.code !== 'ENOENT') throw error; });
await copyFile('node_modules/three/LICENSE', 'web-dist/third-party-licenses.txt');
console.log('Browser build ready: web-dist/');
