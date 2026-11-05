const { execFileSync } = require('node:child_process');
const path = require('node:path');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
module.exports = async function sign(configuration) {
  const name = path.basename(configuration.path);
  // Only the branded app and its portable wrapper are ours. Preserve vendor binaries.
  if (!['Wave History.exe', 'Wave History Portable.exe'].includes(name)) return;
  const env = { ...process.env }; delete env.PSModulePath;
  const signer = process.env.WAVE_SIGNING_SCRIPT || 'C:\\Users\\PC\\Desktop\\DATA\\Цифровая подпись\\Sign-Program.ps1';
  execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'AllSigned', '-Command',
    `Import-Module Microsoft.PowerShell.Security; & ${quote(signer)} -Path ${quote(configuration.path)}`
  ], { env, stdio: 'inherit', windowsHide: true });
};
