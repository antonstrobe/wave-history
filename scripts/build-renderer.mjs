import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
export async function buildRenderer(directory = 'dist') {
  await mkdir(directory, { recursive: true });
  for (const entry of ['app', 'audio-worklet']) await build({ entryPoints: [`src/${entry}.js`], outfile: `${directory}/${entry}.js`, bundle: true, format: 'esm', minify: true });
  for (const file of ['index.html', 'style.css']) await copyFile(`src/${file}`, `${directory}/${file}`);
}
