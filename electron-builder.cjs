module.exports = {
  appId: 'pro.okronoom.wavehistory',
  productName: 'Wave History',
  copyright: 'Copyright (c) 2026 okronoom',
  electronDist: 'node_modules/electron/dist',
  directories: { output: 'release', buildResources: 'assets' },
  files: ['main.cjs', 'dist/**/*', 'package.json'],
  asar: true,
  npmRebuild: false,
  compression: 'normal',
  publish: null,
  win: {
    target: [{ target: 'portable', arch: ['x64'] }],
    icon: 'assets/wave-history.ico',
    executableName: 'Wave History',
    requestedExecutionLevel: 'asInvoker',
    signtoolOptions: {
      sign: './scripts/sign-windows.cjs',
      signingHashAlgorithms: ['sha256'],
      publisherName: 'okronoom'
    }
  },
  portable: {
    artifactName: 'Wave History Portable.exe',
    requestExecutionLevel: 'user',
    unpackDirName: false
  }
};
