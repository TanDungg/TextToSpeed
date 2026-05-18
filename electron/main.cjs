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

async function handleVideoDownload(event, { url }) {
  const fs = require('fs');
  const util = require('util');
  const { exec } = require('child_process');
  const execAsync = util.promisify(exec);

  const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `original_${Date.now()}.mp4`);
  const command = `yt-dlp --js-runtimes node --no-playlist --ignore-errors --write-auto-subs --write-subs --sub-langs "en,vi,zh" -f "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/mp4/b" --merge-output-format mp4 -o "${outputPath}" "${url}"`;

  try {
    await execAsync(command);

    if (fs.existsSync(outputPath)) {
      // Tìm xem có file phụ đề nào được tải về cùng tên gốc không
      const baseWithoutExt = outputPath.slice(0, -4); // Cắt đuôi .mp4
      const files = fs.readdirSync(tempDir);
      const subFile = files.find(f => f.startsWith(path.basename(baseWithoutExt)) && (f.endsWith('.vtt') || f.endsWith('.srt')));
      
      let subContent = '';
      let subPath = '';
      if (subFile) {
        subPath = path.join(tempDir, subFile);
        subContent = fs.readFileSync(subPath, 'utf8');
      }

      return { ok: true, path: outputPath, subContent, subPath };
    }

    // Thử tìm các file có extension khác nếu yt-dlp không convert được sang mp4
    const files = fs.readdirSync(tempDir);
    const foundFile = files.find((f) => f.startsWith(path.basename(outputPath, '.mp4')));
    if (foundFile) {
      const actualPath = path.join(tempDir, foundFile);
      const actualBaseWithoutExt = actualPath.slice(0, -4);
      const subFile = files.find(f => f.startsWith(path.basename(actualBaseWithoutExt)) && (f.endsWith('.vtt') || f.endsWith('.srt')));
      
      let subContent = '';
      let subPath = '';
      if (subFile) {
        subPath = path.join(tempDir, subFile);
        subContent = fs.readFileSync(subPath, 'utf8');
      }

      return { ok: true, path: actualPath, subContent, subPath };
    }

    return {
      ok: false,
      error: 'Tải thành công nhưng không tìm thấy file video. Vui lòng thử lại.',
    };
  } catch (error) {
    console.warn('Download command finished with potential warnings/errors:', error.message);
    
    // Nếu file video thực tế vẫn được tải thành công (dù lỗi phụ đề)
    if (fs.existsSync(outputPath)) {
      return { ok: true, path: outputPath, subContent: '', subPath: '' };
    }

    const files = fs.readdirSync(tempDir);
    const foundFile = files.find((f) => f.startsWith(path.basename(outputPath, '.mp4')));
    if (foundFile) {
      return { ok: true, path: path.join(tempDir, foundFile), subContent: '', subPath: '' };
    }

    console.error('Download Error:', error);
    const stderr = error.stderr || '';
    const isNotFound =
      stderr.toLowerCase().includes('not recognized') ||
      error.message.toLowerCase().includes('not found');
    return {
      ok: false,
      error: isNotFound
        ? 'Vui lòng cài đặt yt-dlp và thêm vào PATH.'
        : `Lỗi tải video: ${stderr || error.message}`,
    };
  }
}

ipcMain.handle('video-download', handleVideoDownload);

async function handleVideoRemake(event, { inputPath, options }) {
  const fs = require('fs');
  const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  let outputPath = inputPath.replace('original_', 'remaked_');
  if (outputPath === inputPath) {
    outputPath = inputPath.replace(/\.mp4$/i, '_final.mp4');
  }

  // Kiểm tra xem video có audio không (Dùng đồng bộ để phẳng code)
  let hasAudio = false;
  try {
    const { execSync } = require('child_process');
    const audioCheck = execSync(
      `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${inputPath}"`
    )
      .toString()
      .trim();
    hasAudio = audioCheck !== '';
  } catch (e) {
    console.warn('Failed to check audio streams:', e.message);
  }

  let filters = [];
  if (options.flip) filters.push('hflip');
  if (options.crop) filters.push('scale=1.1*iw:-1,crop=iw/1.1:ih/1.1');
  if (options.grain) filters.push('noise=alls=7:allf=t+u');

  const speed = options.speed || 1.05;

  // Xây dựng chuỗi filter cho FFmpeg
  let vFilters = filters.length > 0 ? filters : [];

  let vFilterStr = vFilters.length > 0 ? vFilters.join(',') : 'copy';
  if (vFilterStr !== 'copy') vFilterStr = `[0:v]${vFilterStr},setpts=PTS/${speed}[v]`;
  else vFilterStr = `[0:v]setpts=PTS/${speed}[v]`;

  let command = '';

  // --- LOGIC GẮN MỐC THỜI GIAN (SRT TIMESTAMPS) ---
  const vFilterStrFinal = vFilterStr !== 'copy' ? vFilterStr : '[0:v]copy[v]';
  const relInput = path.join('..', path.basename(inputPath));
  const relOutput = path.join('..', path.basename(outputPath));

  const externalAudioList = options.externalAudioList || [];

  if (externalAudioList.length > 0) {
    // Xây dựng chuỗi lệnh nạp tất cả các file audio
    let inputStr = `ffmpeg -i "${relInput}" `;
    let filterParts = [];
    let mixInputs = '';

    externalAudioList.forEach((audio, index) => {
      const relPath = path.basename(audio.path);
      inputStr += `-i "${relPath}" `;
      // Tính lại start time nếu video đang bị thay đổi tốc độ (lách bản quyền)
      // Giây thứ 20 ở video gốc -> Giây thứ (20 / speed) ở video mới
      // Đảm bảo delay không bao giờ bị âm
      const delayMs = Math.max(0, Math.round(audio.startMs / speed));

      // Audio stream index bắt đầu từ 1 (vì 0 là video gốc)
      const streamIdx = index + 1;
      // Áp dụng bộ lọc adelay với :all=1 để tự động delay toàn bộ channel (tương thích cả mono và stereo)
      // Ép định dạng stereo qua aformat để khớp 100% với âm thanh nền, tránh việc amix bỏ qua hoặc làm mất tiếng mono
      filterParts.push(`[${streamIdx}:a]adelay=${delayMs}:all=1,volume=1.5,aformat=channel_layouts=stereo[a${streamIdx}]`);
      mixInputs += `[a${streamIdx}]`;
    });

    // Xử lý âm thanh gốc: giảm âm lượng xuống 10% (0.1) và đồng bộ tốc độ
    filterParts.push(`[0:a]atempo=${speed},volume=0.1[bg_a]`);

    // Trộn tất cả lại: âm thanh gốc + các file voice (Tắt tự động giảm âm lượng normalize=0)
    // Số lượng input = số file voice + 1 (âm thanh gốc)
    const totalInputs = externalAudioList.length + 1;
    filterParts.push(`[bg_a]${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`);

    const filterStr = `${vFilterStrFinal};${filterParts.join(';')}`;
    command = `${inputStr} -filter_complex "${filterStr}" -map "[v]" -map "[a]" -c:v libx264 -preset superfast -y "${relOutput}"`;
  } else if (hasAudio) {
    const aFilter = `[0:a]atempo=${speed}[a]`;
    command = `ffmpeg -i "${relInput}" -filter_complex "${vFilterStrFinal};${aFilter}" -map "[v]" -map "[a]" -c:v libx264 -preset superfast -y "${relOutput}"`;
  } else {
    command = `ffmpeg -i "${relInput}" -filter_complex "${vFilterStrFinal}" -map "[v]" -c:v libx264 -preset superfast -y "${relOutput}"`;
  }

  // Chạy lệnh đồng bộ bằng Promisify để phẳng code hoàn toàn
  try {
    const util = require('util');
    const execPromise = util.promisify(exec);
    await execPromise(command, { cwd: tempDir });
    return { ok: true, path: outputPath };
  } catch (error) {
    console.error('Remake Error:', error.message);
    const isNotFound =
      error.message.toLowerCase().includes('not recognized') ||
      error.message.toLowerCase().includes('not found');

    let errorMsg = 'Vui lòng cài đặt FFmpeg để sử dụng tính năng này.';
    if (!isNotFound) {
      errorMsg = `Lỗi FFmpeg: ${error.message}`;
    }
    return { ok: false, error: errorMsg };
  }
}

ipcMain.handle('video-remake', handleVideoRemake);

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
  const audioPath = videoPath.replace(/\.[^/.]+$/, '') + '_audio.mp3';
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

    // Tự động nhận diện nếu người dùng nhập Groq Key (thường bắt đầu bằng gsk_)
    const isGroq = apiKey.startsWith('gsk_');
    const apiUrl = isGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions';

    // Tên model của Groq là whisper-large-v3, của OpenAI là whisper-1
    form.append('model', isGroq ? 'whisper-large-v3' : 'whisper-1');
    // Groq chỉ hỗ trợ: json, text, verbose_json (không hỗ trợ srt trực tiếp)
    form.append('response_format', isGroq ? 'verbose_json' : 'srt');

    const response = await axios.post(apiUrl, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (isGroq) {
      // Chuyển đổi dữ liệu verbose_json từ Groq sang chuỗi SRT tiêu chuẩn
      const data = response.data;
      if (data && data.segments) {
        const formatSrtTime = (seconds) => {
          const pad = (num, size) => ('000' + num).slice(-size);
          const hrs = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          const ms = Math.floor(Math.round((seconds % 1) * 1000));
          return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
        };

        let srtText = '';
        data.segments.forEach((seg, index) => {
          const start = formatSrtTime(seg.start);
          const end = formatSrtTime(seg.end);
          srtText += `${index + 1}\n${start} --> ${end}\n${seg.text.trim()}\n\n`;
        });
        return { ok: true, text: srtText };
      } else {
        throw new Error('Groq không trả về dữ liệu segments trong verbose_json');
      }
    }

    return { ok: true, text: response.data }; // response.data giờ là chuỗi SRT
  } catch (error) {
    console.error('Whisper Error:', error.response?.data || error.message);
    const apiErrorMsg = error.response?.data?.error?.message || error.message;
    return { ok: false, error: apiErrorMsg };
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

ipcMain.handle('show-item-in-folder', async (event, { filePath }) => {
  try {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
    return { ok: true };
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
  const checkFfmpeg = () =>
    new Promise((resolve) => {
      exec('ffmpeg -version', (error) => resolve(!error));
    });
  const checkYtdlp = () =>
    new Promise((resolve) => {
      exec('yt-dlp --version', (error) => resolve(!error));
    });

  const hasFfmpeg = await checkFfmpeg();
  const hasYtdlp = await checkYtdlp();

  return {
    ffmpeg: hasFfmpeg,
    ytdlp: hasYtdlp,
  };
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
