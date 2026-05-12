const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { exec } = require('child_process');

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

  // mainWindow.webContents.openDevTools();
}

// Hàm thực hiện cú click chuột thông qua PowerShell
function simulateClick(button = 'left', type = 'single') {
  const btnCode = button === 'right' ? '0x0008 | 0x0010' : (button === 'middle' ? '0x0020 | 0x0040' : '0x0002 | 0x0004');
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
