import { buildRenderer } from './build-renderer.mjs';
import { spawn } from 'node:child_process';
import electron from 'electron';
await buildRenderer();
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
