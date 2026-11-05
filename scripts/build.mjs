import { buildRenderer } from './build-renderer.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
await buildRenderer();
if (process.platform === 'win32') {
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const signer = process.env.WAVE_SIGNING_SCRIPT || 'C:\\Users\\PC\\Desktop\\DATA\\Цифровая подпись\\Sign-Program.ps1';
  const launcher = fileURLToPath(new URL('../Start-Wave-History.ps1', import.meta.url));
  const env = { ...process.env }; delete env.PSModulePath;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'AllSigned', '-Command', `Import-Module Microsoft.PowerShell.Security; & ${quote(signer)} -Path ${quote(launcher)}`], { stdio: 'inherit', env });
}
console.log('Build complete.');
