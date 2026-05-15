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

ipcMain.handle('video-download', async (event, { url }) => {
  return new Promise((resolve) => {
    // Thư mục lưu tạm
    const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker');
    if (!require('fs').existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir);
    }
    
    const outputPath = path.join(tempDir, `original_${Date.now()}.mp4`);
    
    // Ép buộc định dạng H.264 (avc1) để đảm bảo có hình và tiếng trên mọi trình phát
    const command = `yt-dlp -f "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/mp4/b" --merge-output-format mp4 -o "${outputPath}" "${url}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Download Error:', stderr);
        const isNotFound = stderr.toLowerCase().includes('not recognized') || error.message.toLowerCase().includes('not found');
        resolve({ 
          ok: false, 
          error: isNotFound ? 'Vui lòng cài đặt yt-dlp và thêm vào PATH.' : `Lỗi tải video: ${stderr || error.message}`
        });
      } else {
        // Kiểm tra xem file có thực sự tồn tại không
        if (require('fs').existsSync(outputPath)) {
          resolve({ ok: true, path: outputPath });
        } else {
          // Thử tìm các file có extension khác nếu yt-dlp không convert được sang mp4
          const files = require('fs').readdirSync(tempDir);
          const foundFile = files.find(f => f.startsWith(path.basename(outputPath, '.mp4')));
          if (foundFile) {
            resolve({ ok: true, path: path.join(tempDir, foundFile) });
          } else {
            resolve({ ok: false, error: 'Tải thành công nhưng không tìm thấy file video. Vui lòng thử lại.' });
          }
        }
      }
    });
  });
});

ipcMain.handle('video-remake', async (event, { inputPath, options }) => {
  const fs = require('fs');
  return new Promise((resolve) => {
    const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const outputPath = inputPath.replace('original_', 'remaked_');
    
    // Kiểm tra xem video có audio không
    exec(`ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${inputPath}"`, (err, stdout) => {
      const hasAudio = stdout.trim() !== '';
      
      let filters = [];
      if (options.flip) filters.push('hflip');
      if (options.crop) filters.push('scale=1.1*iw:-1,crop=iw/1.1:ih/1.1');
      if (options.grain) filters.push('noise=alls=7:allf=t+u');
      
      const speed = options.speed || 1.05;
      
      // Xây dựng chuỗi filter cho FFmpeg
      let vFilters = filters.length > 0 ? filters : [];
      
      // Bỏ phần chèn phụ đề tĩnh theo yêu cầu của người dùng
      // (Phần này đã được xóa để tránh hiển thị văn bản không khớp thời gian)
      
      let vFilterStr = vFilters.length > 0 ? vFilters.join(',') : 'copy';
      if (vFilterStr !== 'copy') vFilterStr = `[0:v]${vFilterStr},setpts=PTS/${speed}[v]`;
      else vFilterStr = `[0:v]setpts=PTS/${speed}[v]`;

      let command = '';
      // --- LOGIC AUTO-SYNC: Tính toán để Voice vừa khít Video ---
      let voiceSpeed = speed; // Mặc định dùng tốc độ người dùng chọn
      
      try {
        const { execSync } = require('child_process');
        // Lấy thời lượng video gốc (sử dụng ffprobe)
        const videoDurStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`).toString().trim();
        const videoDuration = parseFloat(videoDurStr);

        if (options.externalAudio && fs.existsSync(options.externalAudio)) {
          // Lấy thời lượng file Voice AI vừa tạo
          const voiceDurStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${options.externalAudio}"`).toString().trim();
          const voiceDuration = parseFloat(voiceDurStr);
          
          if (!isNaN(videoDuration) && !isNaN(voiceDuration) && videoDuration > 0) {
            // Tính toán tốc độ Voice cần thiết để khớp với Video đã được thay đổi tốc độ
            // Công thức: (Thời lượng Voice * Tốc độ Video mới) / Thời lượng Video gốc
            voiceSpeed = (voiceDuration * speed) / videoDuration;
            
            // Giới hạn tốc độ trong khoảng an toàn 0.5x - 2.0x để tránh méo tiếng quá mức
            voiceSpeed = Math.min(Math.max(voiceSpeed, 0.7), 1.9);
            console.log(`Auto-Sync: Video ${videoDuration}s, Voice ${voiceDuration}s => New Voice Speed: ${voiceSpeed.toFixed(2)}x`);
          }
        }
      } catch (syncErr) {
        console.warn('Auto-Sync failed, using default speed:', syncErr.message);
      }
      // ---------------------------------------------------------

      const vFilterStrFinal = vFilterStr !== 'copy' ? vFilterStr : '[0:v]copy[v]';
      
      const relInput = path.join('..', path.basename(inputPath));
      const relOutput = path.join('..', path.basename(outputPath));
      const relExternalAudio = options.externalAudio ? path.basename(options.externalAudio) : null;

      if (relExternalAudio && fs.existsSync(options.externalAudio)) {
        // Áp dụng voiceSpeed đã tính toán cho giọng đọc [1:a]
        command = `ffmpeg -i "${relInput}" -i "${relExternalAudio}" -filter_complex "${vFilterStrFinal};[1:a]atempo=${voiceSpeed}[new_a];[0:a]volume=0.2[bg_a];[bg_a][new_a]amix=inputs=2:duration=first[a]" -map "[v]" -map "[a]" -c:v libx264 -preset superfast -y "${relOutput}"`;
      } else if (hasAudio) {
        const aFilter = `[0:a]atempo=${speed}[a]`;
        command = `ffmpeg -i "${relInput}" -filter_complex "${vFilterStrFinal};${aFilter}" -map "[v]" -map "[a]" -c:v libx264 -preset superfast -y "${relOutput}"`;
      } else {
        command = `ffmpeg -i "${relInput}" -filter_complex "${vFilterStrFinal}" -map "[v]" -c:v libx264 -preset superfast -y "${relOutput}"`;
      }
      
      // Chạy lệnh với cwd là tempDir để FFmpeg tự tìm thấy các file tương đối
      exec(command, { cwd: tempDir }, (error, stdout, stderr) => {
        if (error) {
          console.error('Remake Error:', stderr);
          // Kiểm tra nếu lỗi là do không tìm thấy lệnh
          const isNotFound = stderr.toLowerCase().includes('not recognized') || error.message.toLowerCase().includes('not found') || error.code === 127;
          
          let errorMsg = 'Vui lòng cài đặt FFmpeg để sử dụng tính năng này.';
          if (!isNotFound) {
            errorMsg = `Lỗi FFmpeg: ${stderr || error.message}`;
          }
          
          resolve({ ok: false, error: errorMsg });
        } else {
          resolve({ ok: true, path: outputPath });
        }
      });
    });
  });
});

ipcMain.handle('save-temp-audio', async (event, { buffer, ext = 'mp3' }) => {
  const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp');
  if (!require('fs').existsSync(tempDir)) {
    require('fs').mkdirSync(tempDir, { recursive: true });
  }
  const audioPath = path.join(tempDir, `temp_${Date.now()}.${ext}`);
  require('fs').writeFileSync(audioPath, Buffer.from(buffer));
  return audioPath;
});

ipcMain.handle('extract-audio', async (event, { videoPath }) => {
  const audioPath = videoPath.replace(/\.[^/.]+$/, "") + "_audio.mp3";
  return new Promise((resolve) => {
    exec(`ffmpeg -i "${videoPath}" -q:a 0 -map a -y "${audioPath}"`, (error) => {
      if (error) resolve({ ok: false, error: error.message });
      else resolve({ ok: true, path: audioPath });
    });
  });
});

ipcMain.handle('transcribe-audio', async (event, { audioPath, apiKey }) => {
  try {
    const fs = require('fs');
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return { ok: true, text: response.data.text };
  } catch (error) {
    console.error('Whisper Error:', error.response?.data || error.message);
    return { ok: false, error: error.response?.data?.error?.message || error.message };
  }
});

ipcMain.handle('read-file-base64', async (event, { filePath }) => {
  try {
    const fs = require('fs');
    const buffer = fs.readFileSync(filePath);
    return { ok: true, data: buffer.toString('base64') };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('list-gemini-models', async (event, { apiKey }) => {
  try {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const response = await axios.get(url);
    return { ok: true, models: response.data.models };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

// Thêm endpoint kiểm tra môi trường
ipcMain.handle('check-env', async () => {
  const checkFfmpeg = () => new Promise(resolve => {
    exec('ffmpeg -version', (error) => resolve(!error));
  });
  const checkYtdlp = () => new Promise(resolve => {
    exec('yt-dlp --version', (error) => resolve(!error));
  });

  const hasFfmpeg = await checkFfmpeg();
  const hasYtdlp = await checkYtdlp();

  return {
    ffmpeg: hasFfmpeg,
    ytdlp: hasYtdlp
  };
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
