const { app, BrowserWindow, ipcMain, globalShortcut, Menu, protocol } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// Register the media protocol as secure, standard, supporting fetch, streaming, and CORS
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

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
  // Register a custom protocol to safely load local media files in the renderer
  protocol.handle('media', (request) => {
    const { net } = require('electron');
    const { pathToFileURL } = require('url');
    // Extract local file path from media:// URL
    const urlPath = request.url.replace('media://', '');
    let decodedPath = decodeURIComponent(urlPath);
    
    // Restore the Windows drive colon if stripped by Chromium's URL parser (e.g. 'd/' -> 'd:/')
    if (/^[a-zA-Z]\//.test(decodedPath)) {
      decodedPath = decodedPath[0] + ':' + decodedPath.slice(1);
    }
    
    try {
      return net.fetch(pathToFileURL(decodedPath).toString());
    } catch (err) {
      console.error('Failed to stream local file via media protocol:', err);
    }
  });

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

  // Kiểm tra xem video có video stream không
  let hasVideo = false;
  try {
    const { execSync } = require('child_process');
    const videoCheck = execSync(
      `ffprobe -v error -select_streams v -show_entries stream=index -of csv=p=0 "${inputPath}"`
    )
      .toString()
      .trim();
    hasVideo = videoCheck !== '';
  } catch (e) {
    console.warn('Failed to check video streams:', e.message);
  }

  if (!hasAudio && !hasVideo) {
    return { ok: false, error: 'File đầu vào không hợp lệ hoặc không chứa bất kỳ luồng âm thanh hoặc video nào.' };
  }

  const isStrong = options.remakeLevel === 'strong';
  let filters = [];
  if (options.flip) filters.push('hflip');
  
  if (options.colorShift) {
    if (isStrong) {
      // LÁCH MẠNH (YouTube Content ID): Zoom nhẹ 4% (crop & scale) để phá tọa độ điểm ảnh, thay đổi hệ màu rõ hơn, thêm hạt nhiễu (noise grain) nhẹ
      filters.push(
        'crop=in_w*0.96:in_h*0.96,scale=in_w:in_h',
        'hue=h=4:s=1.15',
        'eq=contrast=1.08:brightness=0.02:saturation=1.15',
        'noise=alls=5:allf=t'
      );
    } else {
      // Lách thường (TikTok/FB)
      filters.push('hue=h=2:s=1.05,eq=contrast=1.03:brightness=0.01');
    }
  }
  
  if (options.vignette) {
    if (isStrong) {
      // Góc tối rõ nét hơn
      filters.push('vignette=PI/6');
    } else {
      filters.push('vignette=PI/8');
    }
  }

  const speed = options.speed || 1.05;

  const relInput = path.join('..', path.basename(inputPath));
  const relOutput = path.join('..', path.basename(outputPath));

  let filterComplexParts = [];
  let mapArgs = [];

  // 1. Xử lý luồng Video (nếu có)
  if (hasVideo) {
    let vFilters = filters.length > 0 ? filters : [];
    let vFilterStr = vFilters.length > 0 ? vFilters.join(',') : 'copy';
    if (vFilterStr !== 'copy') {
      vFilterStr = `[0:v]${vFilterStr},setpts=PTS/${speed}[v]`;
    } else {
      vFilterStr = `[0:v]setpts=PTS/${speed}[v]`;
    }
    filterComplexParts.push(vFilterStr);
    mapArgs.push('-map "[v]"');
  }

  // 2. Xử lý luồng Audio (nếu có hoặc có âm thanh ngoài chèn thêm)
  // Xây dựng chuỗi lọc âm thanh gốc để lách bản quyền nâng cao
  let aFilters = [];
  aFilters.push(`atempo=${speed}`);
  if (options.audioPitch) {
    if (isStrong) {
      // Lách mạnh: Nâng tông giọng rõ hơn (+4%), thêm bộ tăng âm trầm/bổng (bass/treble EQ) để đổi tần số
      aFilters.push('asetrate=44100*1.04', 'atempo=1/1.04', 'bass=g=3', 'treble=g=1.5');
    } else {
      aFilters.push('asetrate=44100*1.02', 'atempo=1/1.02');
    }
  }
  if (options.audioDelay) {
    if (isStrong) {
      // Lách mạnh: Độ trễ lớn hơn (100ms) và tiếng vang rõ hơn (delay 25ms)
      aFilters.push('adelay=100|100', 'aecho=0.8:0.85:25:0.25');
    } else {
      aFilters.push('adelay=50|50', 'aecho=0.8:0.88:6:0.2');
    }
  }
  const aFilterStr = aFilters.join(',');

  const externalAudioList = options.externalAudioList || [];
  let inputStr = `ffmpeg -i "${relInput}" `;

  if (externalAudioList.length > 0) {
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
      const outLabel = (externalAudioList.length === 1 && !hasAudio) ? '[a]' : `[a${streamIdx}]`;
      filterParts.push(`[${streamIdx}:a]adelay=${delayMs}:all=1,volume=1.5,aformat=channel_layouts=stereo${outLabel}`);
      mixInputs += outLabel;
    });

    if (hasAudio) {
      // Xử lý âm thanh gốc: giảm âm lượng xuống 10% (0.1) và áp dụng các bộ lọc lách bản quyền âm thanh
      filterParts.push(`[0:a]${aFilterStr},volume=0.1[bg_a]`);
      // Trộn tất cả lại: âm thanh gốc + các file voice (Tắt tự động giảm âm lượng normalize=0)
      // Số lượng input = số file voice + 1 (âm thanh gốc)
      const totalInputs = externalAudioList.length + 1;
      filterParts.push(`[bg_a]${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`);
    } else {
      const totalInputs = externalAudioList.length;
      if (totalInputs > 1) {
        filterParts.push(`${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`);
      }
    }

    filterComplexParts.push(...filterParts);
    mapArgs.push('-map "[a]"');
  } else if (hasAudio) {
    filterComplexParts.push(`[0:a]${aFilterStr}[a]`);
    mapArgs.push('-map "[a]"');
  }

  // 3. Xây dựng lệnh FFmpeg hoàn chỉnh
  const filterComplexStr = filterComplexParts.join(';');
  let commandArgs = [];
  if (filterComplexStr) {
    commandArgs.push(`-filter_complex "${filterComplexStr}"`);
  }
  commandArgs.push(...mapArgs);

  if (hasVideo) {
    commandArgs.push('-c:v libx264 -preset superfast');
  }

  const command = `${inputStr} ${commandArgs.join(' ')} -y "${relOutput}"`;

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

ipcMain.handle('select-file', async (event, { type }) => {
  const { dialog } = require('electron');
  const filters = type === 'image'
    ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
    : type === 'video'
      ? [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }]
      : [{ name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'mp4', 'mkv', 'avi', 'mov', 'webm'] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters
  });
  return result;
});

ipcMain.handle('media-enhance', async (event, { inputPath, type, options }) => {
  const fs = require('fs');
  const util = require('util');
  const { exec } = require('child_process');
  const execAsync = util.promisify(exec);

  const ext = path.extname(inputPath);
  const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'enhanced');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `enhanced_${Date.now()}${ext}`);

  // Detect if the video/image is vertical (height > width)
  let isVertical = false;
  try {
    const { execSync } = require('child_process');
    const dimensions = execSync(
      `ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "${inputPath}"`
    )
      .toString()
      .trim();
    const [w, h] = dimensions.split(',').map(Number);
    isVertical = h > w;
  } catch (e) {
    console.warn('Failed to check dimensions via ffprobe, falling back:', e.message);
  }

  // Build FFmpeg filter complex
  let filters = [];
  
  // 1. Denoise (using adjustable strength)
  if (options.denoise && options.denoise > 0) {
    const lSpatial = (4.0 * options.denoise).toFixed(1);
    const cSpatial = (3.0 * options.denoise).toFixed(1);
    const lTmp = (6.0 * options.denoise).toFixed(1);
    const cTmp = (4.5 * options.denoise).toFixed(1);
    filters.push(`hqdn3d=${lSpatial}:${cSpatial}:${lTmp}:${cTmp}`);
  }

  // 2. Scale (upscaling to 1080p, 2K, or 4K with auto-adaptive horizontal/vertical matching)
  if (options.resolution && options.resolution !== 'original') {
    let targetWidth = 1920;
    let targetHeight = 1080;
    
    if (options.resolution === '2k') {
      targetWidth = isVertical ? 1440 : 2560;
      targetHeight = isVertical ? 2560 : 1440;
    } else if (options.resolution === '4k') {
      targetWidth = isVertical ? 2160 : 3840;
      targetHeight = isVertical ? 3840 : 2160;
    } else if (options.resolution === '1080p') {
      targetWidth = isVertical ? 1080 : 1920;
      targetHeight = isVertical ? 1920 : 1080;
    }
    
    filters.push(`scale='if(gte(iw,ih),${targetWidth},-2)':'if(gte(iw,ih),-2,${targetHeight})':flags=lanczos`);
  } else if (options.scale && options.scale > 1.0) {
    // Fallback for old options compatibility
    filters.push(`scale='trunc(iw*${options.scale}/2)*2':'trunc(ih*${options.scale}/2)*2':flags=lanczos`);
  }

  // 3. Sharpen (unsharp) - Upgraded to dual-stage multi-scale sharpening for phenomenal clarity and detail definition
  if (options.sharpenAmount && options.sharpenAmount > 0) {
    const amount1 = Math.min(1.5, options.sharpenAmount * 0.8).toFixed(2);
    const amount2 = Math.min(1.5, options.sharpenAmount * 1.2).toFixed(2);
    
    let matrixSize = 7; // Default 7x7 for 1080p and original
    if (options.resolution === '4k') {
      matrixSize = 11; // 11x11 matrix for 4K outlines
    } else if (options.resolution === '2k') {
      matrixSize = 9;  // 9x9 matrix for 2K outlines
    }
    
    // Stage 1: Fine-scale matrix (5x5) for high-frequency details (hair, textures)
    filters.push(`unsharp=5:5:${amount1}:5:5:0.0`);
    // Stage 2: Medium-scale matrix (7x7 / 9x9 / 11x11) for structural edges and outlines
    filters.push(`unsharp=${matrixSize}:${matrixSize}:${amount2}:${matrixSize}:${matrixSize}:0.0`);
  }

  // 4. Color / Contrast / Brightness / Saturation
  if (
    (options.contrast !== undefined && options.contrast !== 1.0) ||
    (options.brightness !== undefined && options.brightness !== 0.0) ||
    (options.saturation !== undefined && options.saturation !== 1.0)
  ) {
    const contrast = options.contrast !== undefined ? options.contrast : 1.0;
    const brightness = options.brightness !== undefined ? options.brightness : 0.0;
    const saturation = options.saturation !== undefined ? options.saturation : 1.0;
    filters.push(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}`);
  }

  let filterStr = filters.join(',');

  // Check if video has an audio stream
  let hasAudio = false;
  if (type === 'video') {
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
  }

  let command = '';
  const audioArg = hasAudio ? '-c:a copy' : '-an';

  if (type === 'image') {
    if (filterStr) {
      command = `ffmpeg -loglevel error -i "${inputPath}" -vf "${filterStr}" -y "${outputPath}"`;
    } else {
      command = `ffmpeg -loglevel error -i "${inputPath}" -y "${outputPath}"`;
    }
  } else {
    // Video processing
    if (filterStr) {
      command = `ffmpeg -loglevel error -i "${inputPath}" -vf "${filterStr}" -c:v libx264 -preset superfast ${audioArg} -y "${outputPath}"`;
    } else {
      command = `ffmpeg -loglevel error -i "${inputPath}" -c:v copy ${audioArg} -y "${outputPath}"`;
    }
  }

  try {
    // Run FFmpeg with extended buffer (50MB) and suppressed progress logs (-loglevel error)
    await execAsync(command, { maxBuffer: 1024 * 1024 * 50 });
    if (fs.existsSync(outputPath)) {
      return { ok: true, path: outputPath };
    } else {
      return { ok: false, error: 'Không thể tạo file đầu ra. Vui lòng thử lại.' };
    }
  } catch (error) {
    console.error('Enhancement error:', error.message);
    const isNotFound =
      error.message.toLowerCase().includes('not recognized') ||
      error.message.toLowerCase().includes('not found');
    return {
      ok: false,
      error: isNotFound
        ? 'Vui lòng cài đặt FFmpeg và thêm vào PATH để sử dụng tính năng này.'
        : `Lỗi FFmpeg: ${error.message}`
    };
  }
});

ipcMain.handle('lofi-search-metadata', async (event, { url }) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  try {
    const { stdout } = await execAsync(`yt-dlp --print "%(title)s|%(duration_string)s" --no-playlist "${url}"`);
    const parts = stdout.trim().split('|');
    if (parts.length >= 2) {
      return { ok: true, title: parts[0], duration: parts[1] };
    }
    return { ok: true, title: stdout.trim() || 'Unknown Title', duration: '0:00' };
  } catch (error) {
    console.error('Lofi search metadata error:', error.message);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('lofi-search-beats', async (event, { key, bpm }) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  const query = `Lofi type beat ${key} ${bpm} bpm`;
  try {
    const { stdout } = await execAsync(`yt-dlp --print "%(title)s|%(id)s|%(duration_string)s" --no-playlist "ytsearch5:${query}"`);
    const lines = stdout.trim().split('\n');
    const results = lines.map(line => {
      const parts = line.split('|');
      if (parts.length >= 3) {
        return {
          title: parts[0],
          id: parts[1],
          url: `https://www.youtube.com/watch?v=${parts[1]}`,
          duration: parts[2]
        };
      }
      return null;
    }).filter(Boolean);

    return { ok: true, results };
  } catch (error) {
    console.error('Lofi search beats error:', error.message);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('lofi-download-pair', async (event, { url, beatUrl, title }) => {
  const fs = require('fs');
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const destDir = path.join(app.getPath('downloads'), 'LofiHelper', cleanTitle);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const originalPath = path.join(destDir, 'Original_Song.mp3');
  const beatPath = path.join(destDir, 'Lofi_Beat.mp3');

  try {
    const cmdOriginal = `yt-dlp -x --audio-format mp3 --no-playlist -o "${originalPath}" "${url}"`;
    await execAsync(cmdOriginal);

    const cmdBeat = `yt-dlp -x --audio-format mp3 --no-playlist -o "${beatPath}" "${beatUrl}"`;
    await execAsync(cmdBeat);

    const { shell } = require('electron');
    shell.openPath(destDir);

    return { ok: true, destDir };
  } catch (error) {
    console.error('Lofi download pair error:', error.message);
    return { ok: false, error: error.message };
  }
});


app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
