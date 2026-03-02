const electron = require('electron');
const { app, BrowserWindow, shell, nativeImage, Tray, Menu } = electron;
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Electron puede fallar sin display (ej. terminal de Cursor). En ese caso abrir navegador.
if (!app) {
    console.error('❌ Electron no disponible. Abriendo http://localhost:3000 en el navegador...');
    if (process.platform === 'darwin') {
        try {
            require('child_process').execSync('open http://localhost:3000', { stdio: 'ignore' });
        } catch (_) {}
    }
    process.exit(1);
}

// Configuración
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_PORT = 8000;
let mainWindow;
let pythonProcess;
let tray;

// Función para arrancar el backend Python (solo si no está ya corriendo)
function startPythonBackend() {
    if (process.env.BACKEND_ALREADY_RUNNING === '1') {
        console.log('📡 Backend ya iniciado por start_app.sh');
        return;
    }
    const scriptPath = path.join(__dirname, '..', 'rte_server.py');
    console.log('🚀 Iniciando servidor Python desde:', scriptPath);

    pythonProcess = spawn('python3', [scriptPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });

    pythonProcess.on('error', (err) => {
        console.error('❌ Error al iniciar Python:', err);
    });
}

function createWindow() {
    // Icono de la app (Dock + ventana + tray)
    // Preferimos `cuaderno-ui/public/app-icon.png` si existe.
    // Fallback: tu logo en la raíz del repo (para dev).
    const preferredIconPath = path.join(__dirname, 'public', 'app-icon.png');
    const fallbackIconPath = path.join(__dirname, '..', '..', 'HDEZ_BUENO_logo_transparente_full_calidad.png');
    const iconPath = fs.existsSync(preferredIconPath) ? preferredIconPath : fallbackIconPath;

    const appIcon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin' && appIcon && !appIcon.isEmpty()) {
        // En macOS, para que se vea bien como icono de menú
        appIcon.setTemplateImage(true);
    }

    if (!app.isPackaged && appIcon && !appIcon.isEmpty() && app.dock) {
        // En macOS, establece el icono del Dock durante el desarrollo
        app.dock.setIcon(appIcon);
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        titleBarStyle: 'hiddenInset', // Estilo Mac moderno
        icon: appIcon && !appIcon.isEmpty() ? appIcon : undefined,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false, // No mostrar hasta que esté listo
        backgroundColor: '#09090b', // Fondo oscuro para que no parpadee en blanco
    });

    // Tray / barra de menú (macOS)
    if (process.platform === 'darwin' && !tray && appIcon && !appIcon.isEmpty()) {
        tray = new Tray(appIcon.resize({ width: 18, height: 18 }));
        tray.setToolTip('Cuaderno de Explotación');
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: 'Mostrar',
                click: () => {
                    if (!mainWindow) return;
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            {
                label: 'Ocultar',
                click: () => {
                    if (!mainWindow) return;
                    mainWindow.hide();
                }
            },
            { type: 'separator' },
            {
                label: 'Salir',
                click: () => app.quit()
            }
        ]));
    }

    // Cargar la URL del frontend
    mainWindow.loadURL(FRONTEND_URL);

    // Mostrar cuando esté listo para evitar pantalla blanca
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Abrir enlaces externos en el navegador predeterminado
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Ciclo de vida de la App
app.whenReady().then(() => {
    startPythonBackend();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Cerrar procesos al salir
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (pythonProcess) {
        console.log('🛑 Cerrando servidor Python...');
        pythonProcess.kill();
    }
});
