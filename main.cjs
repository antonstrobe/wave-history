const { app, BrowserWindow, session, desktopCapturer, protocol, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdirSync } = require('node:fs');
protocol.registerSchemesAsPrivileged([{ scheme: 'wave', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const test = process.argv.includes('--test');
const portableDir = app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath)) : null;
if (portableDir) {
  const dataDir = path.join(portableDir, 'Wave History Data', ...(test ? ['test-profile'] : []));
  mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', dataDir);
  app.setPath('sessionData', dataDir);
} else if (test) app.setPath('userData', path.join(__dirname, 'artifacts', 'test-profile'));
app.setName('Wave History');
app.whenReady().then(() => {
  const base = path.join(__dirname, 'dist');
  protocol.handle('wave', request => {
    const url = new URL(request.url);
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (url.host !== 'app' || !file.startsWith(base + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  const isLocal = url => url?.startsWith('wave://app/');
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isLocal(contents?.getURL()) && ['media', 'display-capture', 'fullscreen'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) =>
    (isLocal(contents?.getURL()) || origin === 'wave://app') && ['media', 'display-capture', 'fullscreen'].includes(permission));
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isLocal(request.frame?.url)) return callback({});
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources.length) return callback({});
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback({}); }
  });
  const win = new BrowserWindow({
    width: 1440, height: 930, minWidth: 900, minHeight: 650,
    backgroundColor: '#080a0b', title: 'Wave History', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  win.loadURL('wave://app/index.html' + (test ? '?test=1' : ''));
});
app.on('window-all-closed', () => app.quit());
