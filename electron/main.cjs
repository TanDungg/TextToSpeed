const { app, BrowserWindow, ipcMain, globalShortcut, Menu } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const isDev = !app.isPackaged;
let mainWindow;
let clickInterval = null;
let isClicking = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-electron/index.html'));
  }

  // Mở các link ngoài bằng trình duyệt mặc định của máy tính
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // mainWindow.webContents.openDevTools();
}

// Hàm thực hiện cú click chuột thông qua PowerShell
function simulateClick(button = 'left', type = 'single') {
  const btnCode =
    button === 'right'
      ? '0x0008 | 0x0010'
      : button === 'middle'
        ? '0x0020 | 0x0040'
        : '0x0002 | 0x0004';
  const repeatCount = type === 'double' ? 2 : 1;

  // Script PowerShell để mô phỏng click chuột tại vị trí hiện tại
  const psScript = `
    $sign = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);' -Name "Win32MouseEvent" -Namespace Win32Functions -PassThru
    for ($i = 0; $i -lt ${repeatCount}; $i++) {
      $sign::mouse_event(${btnCode}, 0, 0, 0, 0)
    }
  `;

  exec(`powershell -command "${psScript.replace(/\n/g, '')}"`);
}

function startClicking(config) {
  if (isClicking) return;
  isClicking = true;

  clickInterval = setInterval(() => {
    simulateClick(config.button, config.type);
  }, config.interval || 100);

  if (mainWindow) {
    mainWindow.webContents.send('autoclick-status-changed', true);
  }
}

function stopClicking() {
  if (!isClicking) return;
  isClicking = false;
  if (clickInterval) {
    clearInterval(clickInterval);
    clickInterval = null;
  }

  if (mainWindow) {
    mainWindow.webContents.send('autoclick-status-changed', false);
  }
}

app.whenReady().then(() => {
  createWindow();

  // Thiết lập Menu mặc định cho ứng dụng
  const template = [
    {
      label: 'Ứng dụng',
      submenu: [
        { label: 'Về ứng dụng', role: 'about' },
        { type: 'separator' },
        { label: 'Thoát', role: 'quit' },
      ],
    },
    {
      label: 'Chỉnh sửa',
      submenu: [
        { label: 'Hoàn tác', role: 'undo' },
        { label: 'Làm lại', role: 'redo' },
        { type: 'separator' },
        { label: 'Cắt', role: 'cut' },
        { label: 'Sao chép', role: 'copy' },
        { label: 'Dán', role: 'paste' },
        { label: 'Chọn tất cả', role: 'selectAll' },
      ],
    },
    {
      label: 'Điều hướng',
      submenu: [
        {
          label: 'Quay lại',
          accelerator: 'Alt+Left',
          click: () => {
            if (mainWindow.webContents.navigationHistory.canGoBack())
              mainWindow.webContents.navigationHistory.goBack();
          },
        },
        {
          label: 'Tiếp tới',
          accelerator: 'Alt+Right',
          click: () => {
            if (mainWindow.webContents.navigationHistory.canGoForward())
              mainWindow.webContents.navigationHistory.goForward();
          },
        },
        { type: 'separator' },
        { label: 'Tải lại', role: 'reload' },
        { label: 'Tải lại toàn bộ', role: 'forceReload' },
        { label: 'Công cụ nhà phát triển', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Cửa sổ',
      submenu: [
        { label: 'Thu nhỏ', role: 'minimize' },
        { label: 'Phóng to/Thu nhỏ', role: 'zoom' },
        { type: 'separator' },
        { label: 'Đóng', role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Đăng ký phím tắt toàn cầu F6 (có thể tùy chỉnh)
  globalShortcut.register('F6', () => {
    if (isClicking) {
      stopClicking();
    } else {
      // Sử dụng cấu hình mặc định hoặc cấu hình cuối cùng từ renderer nếu có
      startClicking({ interval: 100, button: 'left', type: 'single' });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Lắng nghe lệnh từ giao diện
ipcMain.on('start-autoclick', (event, config) => {
  startClicking(config);
});

ipcMain.on('stop-autoclick', () => {
  stopClicking();
});

ipcMain.handle('tts-request', async (event, { url, options = {} }) => {
  try {
    const config = {
      method: options.method || 'GET',
      url: url,
      headers: options.headers || {},
      data: options.body,
      responseType: options.method === 'POST' ? 'json' : 'arraybuffer',
    };

    // Đặc biệt cho FPT.AI hoặc Google Cloud có thể cần JSON
    if (
      options.headers?.['Content-Type'] === 'application/json' ||
      options.headers?.['content-type'] === 'application/json'
    ) {
      config.responseType = 'json';
    }

    const response = await axios(config);

    return {
      ok: true,
      data: response.data,
      status: response.status,
      isBinary: config.responseType === 'arraybuffer',
    };
  } catch (error) {
    console.error('Main TTS Request Error:', error.message);
    return {
      ok: false,
      error: error.response?.data || error.message,
    };
  }
});

ipcMain.on('download-file', (event, { url, filename }) => {
  if (mainWindow) {
    mainWindow.webContents.downloadURL(url);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
