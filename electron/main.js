const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

let mainWindow;
let tray = null;
let backendProcess = null;

const isDev = !app.isPackaged;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1100,
        minHeight: 760,
        title: 'Crewmate',
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
        icon: path.join(__dirname, '../public/favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

function startBackend() {
    const backendPath = isDev
        ? path.join(__dirname, '../server/index.ts')
        : path.join(__dirname, '../server/index.js');

    if (isDev) {
        backendProcess = spawn('npx', ['tsx', 'watch', backendPath], { stdio: 'inherit', env: process.env });
    } else {
        backendProcess = spawn('node', [backendPath], { stdio: 'inherit', env: process.env });
    }

    backendProcess.on('error', (err) => {
        console.error('Failed to start backend process:', err);
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../public/favicon.ico')); // ensure icon exists or fallback to default
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Crewmate', click: () => { mainWindow.show(); } },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Crewmate Desktop');
    tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
    startBackend();
    createMainWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

ipcMain.handle('get-desktop-source-id', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    const primaryScreen = sources.find(source => source.id.includes('screen') || source.id.includes('display')) || sources[0];
    return primaryScreen ? primaryScreen.id : null;
});
