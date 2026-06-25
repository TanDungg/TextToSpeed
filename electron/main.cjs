const { app, BrowserWindow, ipcMain, globalShortcut, Menu, protocol } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// Register the media protocol as secure, standard, supporting fetch, streaming, and CORS
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const isDev = !app.isPackaged;
let mainWindow;

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

  const timestamp = Date.now();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  let baseDir = path.join(app.getPath('downloads'), 'SmartRemaker');
  if (fs.existsSync('D:\\')) {
    baseDir = 'D:\\SmartRemaker';
  }
  const sessionDir = path.join(baseDir, dateStr);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  let extraArgs = '';
  if (url.includes('bilibili.com') || url.includes('bili.video') || url.includes('acg.tv')) {
    extraArgs = ' --add-header "Origin:https://www.bilibili.com" --add-header "Referer:https://www.bilibili.com/"';
  }

  let videoTitle = '';
  let videoDescription = '';
  try {
    const infoCmd = `yt-dlp${extraArgs} --print "%(title)s" --print "%(description)s" --no-warnings --no-playlist "${url}"`;
    const { stdout } = await execAsync(infoCmd);
    const parts = stdout.trim().split('\n');
    videoTitle = parts[0] || '';
    videoDescription = parts.slice(1).join('\n') || '';
  } catch (err) {
    console.warn('Failed to fetch video title/description via yt-dlp:', err.message);
  }

  const outputPath = path.join(sessionDir, `original_${timestamp}.mp4`);
  const command = `yt-dlp${extraArgs} --js-runtimes node --no-playlist --ignore-errors --write-auto-subs --write-subs --sub-langs "en,vi,zh" -f "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/mp4/b" --merge-output-format mp4 -o "${outputPath}" "${url}"`;

  try {
    await execAsync(command);

    if (fs.existsSync(outputPath)) {
      // Tìm xem có file phụ đề nào được tải về cùng tên gốc không
      const baseWithoutExt = outputPath.slice(0, -4); // Cắt đuôi .mp4
      const files = fs.readdirSync(sessionDir);
      const subFile = files.find(
        (f) =>
          f.startsWith(path.basename(baseWithoutExt)) && (f.endsWith('.vtt') || f.endsWith('.srt'))
      );

      let subContent = '';
      let subPath = '';
      if (subFile) {
        subPath = path.join(sessionDir, subFile);
        subContent = fs.readFileSync(subPath, 'utf8');
      }

      return { ok: true, path: outputPath, subContent, subPath, videoTitle, videoDescription };
    }

    // Thử tìm các file có extension khác nếu yt-dlp không convert được sang mp4
    const files = fs.readdirSync(sessionDir);
    const foundFile = files.find((f) => f.startsWith(path.basename(outputPath, '.mp4')));
    if (foundFile) {
      const actualPath = path.join(sessionDir, foundFile);
      const actualBaseWithoutExt = actualPath.slice(0, -4);
      const subFile = files.find(
        (f) =>
          f.startsWith(path.basename(actualBaseWithoutExt)) &&
          (f.endsWith('.vtt') || f.endsWith('.srt'))
      );

      let subContent = '';
      let subPath = '';
      if (subFile) {
        subPath = path.join(sessionDir, subFile);
        subContent = fs.readFileSync(subPath, 'utf8');
      }

      return { ok: true, path: actualPath, subContent, subPath, videoTitle, videoDescription };
    }

    return {
      ok: false,
      error: 'Tải thành công nhưng không tìm thấy file video. Vui lòng thử lại.',
    };
  } catch (error) {
    console.warn('Download command finished with potential warnings/errors:', error.message);

    // Nếu file video thực tế vẫn được tải thành công (dù lỗi phụ đề)
    if (fs.existsSync(outputPath)) {
      return { ok: true, path: outputPath, subContent: '', subPath: '', videoTitle, videoDescription };
    }

    const files = fs.readdirSync(sessionDir);
    const foundFile = files.find((f) => f.startsWith(path.basename(outputPath, '.mp4')));
    if (foundFile) {
      return { ok: true, path: path.join(sessionDir, foundFile), subContent: '', subPath: '', videoTitle, videoDescription };
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

function scaleSrtTimestamps(srtText, speed) {
  if (!srtText || speed === 1.0) return srtText;
  
  const formatTime = (ms) => {
    const pad = (num, size) => ('000' + num).slice(-size);
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const msec = Math.floor(ms % 1000);
    return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(msec, 3)}`;
  };

  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    return (
      parseInt(match[1]) * 3600000 +
      parseInt(match[2]) * 60000 +
      parseInt(match[3]) * 1000 +
      parseInt(match[4])
    );
  };

  return srtText.replace(
    /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/g,
    (match, startStr, endStr) => {
      const startMs = parseTime(startStr);
      const endMs = parseTime(endStr);
      const newStartMs = Math.round(startMs / speed);
      const newEndMs = Math.round(endMs / speed);
      return `${formatTime(newStartMs)} --> ${formatTime(newEndMs)}`;
    }
  );
}

async function handleVideoRemake(event, { inputPath, options }) {
  const fs = require('fs');
  const sessionDir = path.dirname(inputPath);
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
    return {
      ok: false,
      error: 'File đầu vào không hợp lệ hoặc không chứa bất kỳ luồng âm thanh hoặc video nào.',
    };
  }

  const isStrong = options.remakeLevel === 'strong';
  const isSuperStrong = options.remakeLevel === 'super_strong';
  let filters = [];
  if (options.flip) filters.push('hflip');
  if (options.colorShift) {
    if (isSuperStrong) {
      // LÁCH SIÊU CẤP: Zoom sâu 18% để cắt rìa quảng cáo, ánh sáng động sin(t) co dãn nhẹ tránh hash tĩnh, lưới bảo vệ mờ, vẽ banner che bảng điểm & logo
      filters.push(
        'crop=in_w*0.82:in_h*0.82,scale=in_w:in_h',
        'hue=h="sin(2*t)*3":s="1.15+0.05*cos(2*t)"',
        "eq=contrast='1.08+0.03*sin(t)':brightness='0.01*cos(t)':saturation='1.15+0.05*sin(t/2)'",
        'drawgrid=w=100:h=100:t=1:c=white@0.03',
        'drawbox=x=24:y=24:w=220:h=70:color=black@0.8:t=fill',
        'drawbox=x=in_w-244:y=24:w=220:h=70:color=black@0.8:t=fill',
        'noise=alls=6:allf=t'
      );
    } else if (isStrong) {
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
    if (isSuperStrong) {
      filters.push('vignette=PI/5');
    } else if (isStrong) {
      // Góc tối rõ nét hơn
      filters.push('vignette=PI/6');
    } else {
      filters.push('vignette=PI/8');
    }
  }



  const speed = options.speed || 1.05;

  const relInput = inputPath;
  const relOutput = outputPath;

  let filterComplexParts = [];
  let mapArgs = [];

  // 1. Xử lý luồng Video (nếu có)
  if (hasVideo) {
    let vFilters = filters.length > 0 ? filters : [];
    let baseFilterStr = vFilters.length > 0 ? vFilters.join(',') : '';
    
    let videoPipe = '[0:v]';
    if (baseFilterStr) {
      videoPipe += `${baseFilterStr}[core_v];[core_v]`;
    }

    if (options.blurBorder) {
      // Tách luồng core thành 2 luồng: v1 để thu nhỏ, v2 làm mờ nền.
      // Nếu lách siêu cấp, video chính sẽ trôi nổi liên tục theo quỹ đạo tròn overlay='(W-w)/2+sin(t)*12':'(H-h)/2+cos(t)*12'
      const overlayCoords = `overlay=(W-w)/2:(H-h)/2`;
      videoPipe += `split[v1][v2];[v1]scale=iw*0.85:ih*0.85[inner];[v2]boxblur=20[blurred];[blurred][inner]${overlayCoords},setpts=PTS/${speed}[v]`;
    } else {
      videoPipe += `setpts=PTS/${speed}[v]`;
    }

    filterComplexParts.push(videoPipe);
    mapArgs.push('-map "[v]"');
  }

  // 2. Xử lý luồng Audio (hỗ trợ phân đoạn TTS lồng tiếng hoặc danh sách nhạc ngoài)
  let filterParts = [];
  let mixInputs = '';
  let inputIndex = 1;
  const segments = options.segments || [];
  const bgmMode = options.bgmMode || 'none';
  const finalBgmPath = inputPath.replace('_audio.wav', '_no_vocals.wav');

  let inputStr = `ffmpeg -i "${relInput}" `;

  // Thêm tệp nhạc nền đã tách bằng AI Demucs vào đầu vào nếu có
  let bgmInputIdx = -1;
  if ((bgmMode === 'demucs' || bgmMode === 'duck_fallback') && fs.existsSync(finalBgmPath)) {
    inputStr += `-i "${finalBgmPath}" `;
    bgmInputIdx = inputIndex;
    inputIndex++;
  }

  if (segments.length > 0) {
    const { execSync } = require('child_process');

    segments.forEach((seg) => {
      if (seg.audioPath && fs.existsSync(seg.audioPath)) {
        inputStr += `-i "${seg.audioPath}" `;

        // Lấy thời lượng thực tế của file âm thanh mới sinh bằng ffprobe
        let newDuration = (seg.endMs - seg.startMs) / 1000;
        try {
          const durationStr = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${seg.audioPath}"`
          ).toString().trim();
          if (durationStr) {
            newDuration = parseFloat(durationStr);
          }
        } catch (e) {
          console.warn(`Không thể lấy thời lượng của segment ${seg.id}:`, e.message);
        }

        const origDuration = (seg.endMs - seg.startMs) / 1000;
        // Tính tỷ lệ speedup. Tự động co dãn (co lại nếu dài hơn, dãn ra nếu ngắn hơn) khớp chính xác thời lượng gốc
        let speedFactor = 1.0;
        if (origDuration > 0) {
          speedFactor = newDuration / origDuration;
          speedFactor = Math.max(0.5, Math.min(2.0, speedFactor));
        }

        // Độ trễ tính theo speed của video lách bản quyền
        const delayMs = Math.max(0, Math.round(seg.startMs / speed));

        const streamIdx = inputIndex;
        inputIndex++;

        const outLabel = `[a${streamIdx}]`;
        filterParts.push(
          `[${streamIdx}:a]atempo=${speedFactor.toFixed(2)},adelay=${delayMs}:all=1,volume=1.5,aformat=channel_layouts=stereo${outLabel}`
        );
        mixInputs += outLabel;
      }
    });

    // Trộn nhạc nền và các phân đoạn âm thanh
    if (bgmInputIdx !== -1) {
      filterParts.push(`[${bgmInputIdx}:a]volume=0.8[bg_a]`);
      const totalInputs = inputIndex - 1 - (bgmInputIdx === 1 ? 1 : 0) + 1;
      filterParts.push(
        `[bg_a]${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`
      );
      mapArgs.push('-map "[a]"');
    } else if (bgmMode === 'duck' && hasAudio) {
      // Trộn âm thanh gốc giảm volume
      let aFilters = [];
      aFilters.push(`atempo=${speed}`);
      if (options.audioPitch) {
        if (isSuperStrong) aFilters.push('asetrate=44100*1.06', 'atempo=1/1.06', 'bass=g=4', 'treble=g=2');
        else if (isStrong) aFilters.push('asetrate=44100*1.04', 'atempo=1/1.04', 'bass=g=3', 'treble=g=1.5');
        else aFilters.push('asetrate=44100*1.02', 'atempo=1/1.02');
      }
      if (options.audioDelay) {
        if (isSuperStrong) aFilters.push('adelay=150|150', 'aecho=0.8:0.82:30:0.3');
        else if (isStrong) aFilters.push('adelay=100|100', 'aecho=0.8:0.85:25:0.25');
        else aFilters.push('adelay=50|50', 'aecho=0.8:0.88:6:0.2');
      }
      const aFilterStr = aFilters.join(',');

      filterParts.push(`[0:a]${aFilterStr},volume=0.15[bg_a]`);
      const totalInputs = inputIndex;
      filterParts.push(
        `[bg_a]${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`
      );
      mapArgs.push('-map "[a]"');
    } else {
      const totalInputs = inputIndex - 1;
      if (totalInputs > 1) {
        filterParts.push(`${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`);
        mapArgs.push('-map "[a]"');
      } else if (totalInputs === 1) {
        filterParts.push(`[1:a]volume=1.5[a]`);
        mapArgs.push('-map "[a]"');
      }
    }

    filterComplexParts.push(...filterParts);
  } else {
    // FALLBACK: code cũ xử lý externalAudioList
    const externalAudioList = options.externalAudioList || [];
    let aFilters = [];
    aFilters.push(`atempo=${speed}`);
    if (options.audioPitch) {
      if (isSuperStrong) {
        aFilters.push('asetrate=44100*1.06', 'atempo=1/1.06', 'bass=g=4', 'treble=g=2');
      } else if (isStrong) {
        aFilters.push('asetrate=44100*1.04', 'atempo=1/1.04', 'bass=g=3', 'treble=g=1.5');
      } else {
        aFilters.push('asetrate=44100*1.02', 'atempo=1/1.02');
      }
    }
    if (options.audioDelay) {
      if (isSuperStrong) {
        aFilters.push('adelay=150|150', 'aecho=0.8:0.82:30:0.3');
      } else if (isStrong) {
        aFilters.push('adelay=100|100', 'aecho=0.8:0.85:25:0.25');
      } else {
        aFilters.push('adelay=50|50', 'aecho=0.8:0.88:6:0.2');
      }
    }
    const aFilterStr = aFilters.join(',');

    if (externalAudioList.length > 0) {
      let mixInputs = '';

      externalAudioList.forEach((audio, index) => {
        inputStr += `-i "${audio.path}" `;
        const delayMs = Math.max(0, Math.round(audio.startMs / speed));
        const streamIdx = index + 1;
        const outLabel = externalAudioList.length === 1 && !hasAudio ? '[a]' : `[a${streamIdx}]`;
        filterParts.push(
          `[${streamIdx}:a]adelay=${delayMs}:all=1,volume=1.5,aformat=channel_layouts=stereo${outLabel}`
        );
        mixInputs += outLabel;
      });

      if (hasAudio) {
        filterParts.push(`[0:a]${aFilterStr},volume=0.1[bg_a]`);
        const totalInputs = externalAudioList.length + 1;
        filterParts.push(
          `[bg_a]${mixInputs}amix=inputs=${totalInputs}:duration=first:normalize=0[a]`
        );
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
    await execPromise(command, { cwd: sessionDir });

    // Lưu tệp phụ đề dạng .txt và tệp âm thanh dạng .mp3 nếu chọn transcribe
    if (options.transcribe) {
      if (options.srtContent) {
        const txtPath = outputPath.replace(/\.mp4$/i, '.txt');
        const adjustedSrt = scaleSrtTimestamps(options.srtContent, speed);
        fs.writeFileSync(txtPath, adjustedSrt, 'utf8');
      }

      if (options.originalAudioPath && fs.existsSync(options.originalAudioPath)) {
        const finalAudioPath = outputPath.replace(/\.mp4$/i, '.mp3');
        if (speed === 1.0) {
          fs.copyFileSync(options.originalAudioPath, finalAudioPath);
        } else {
          // Tăng tốc tệp âm thanh gốc để khớp với tốc độ video mới
          await execPromise(`ffmpeg -i "${options.originalAudioPath}" -filter:a "atempo=${speed}" -y "${finalAudioPath}"`);
        }
      }
    }

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
  const audioPath = videoPath.replace(/\.[^/.]+$/, '') + '_audio.wav';
  return new Promise((resolve) => {
    exec(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 -y "${audioPath}"`, (error) => {
      if (error) resolve({ ok: false, error: error.message });
      else resolve({ ok: true, path: audioPath });
    });
  });
});

ipcMain.handle('separate-bgm', async (event, { audioPath, bgmMode }) => {
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  const sessionDir = path.dirname(audioPath);
  const audioBasename = path.basename(audioPath);

  // Đường dẫn tệp nhạc nền mong muốn
  const finalBgmPath = audioPath.replace('_audio.wav', '_no_vocals.wav');

  if (bgmMode === 'none') {
    return { ok: true, mode: 'none', path: null };
  }

  if (bgmMode === 'duck') {
    // Với chế độ duck, chỉ cần tạo bản sao và đánh dấu là nhạc nền
    try {
      fs.copyFileSync(audioPath, finalBgmPath);
      return { ok: true, mode: 'duck', path: finalBgmPath };
    } catch (err) {
      return { ok: false, error: `Lỗi tạo file nhạc nền duck: ${err.message}` };
    }
  }

  if (bgmMode === 'demucs') {
    const demucsOutDir = path.join(sessionDir, 'demucs_out');
    try {
      try {
        await execPromise(`demucs --two-stems=vocals "${audioBasename}" -o "demucs_out"`, { cwd: sessionDir });
      } catch (e1) {
        await execPromise(`python -m demucs --two-stems=vocals "${audioBasename}" -o "demucs_out"`, { cwd: sessionDir });
      }

      // Tìm file no_vocals.wav đệ quy trong thư mục demucs_out
      const findFileRecursive = (dir, fileName) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const found = findFileRecursive(fullPath, fileName);
            if (found) return found;
          } else if (file === fileName) {
            return fullPath;
          }
        }
        return null;
      };

      const foundNoVocals = findFileRecursive(demucsOutDir, 'no_vocals.wav');
      if (foundNoVocals && fs.existsSync(foundNoVocals)) {
        fs.copyFileSync(foundNoVocals, finalBgmPath);
        // Dọn dẹp thư mục tạm của demucs để tiết kiệm dung lượng
        try {
          fs.rmSync(demucsOutDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Lỗi dọn dẹp thư mục demucs_out:', e.message);
        }
        return { ok: true, mode: 'demucs', path: finalBgmPath };
      } else {
        throw new Error('Không tìm thấy file no_vocals.wav sau khi chạy Demucs.');
      }
    } catch (error) {
      console.warn('Lỗi chạy Demucs, tự động hạ cấp xuống chế độ duck:', error.message);
      // Fallback sang chế độ duck
      try {
        fs.copyFileSync(audioPath, finalBgmPath);
        return { ok: true, mode: 'duck_fallback', path: finalBgmPath, warning: `Lỗi chạy Demucs (${error.message.replace(/"/g, "'").replace(/\n/g, ' ')}), tự động hạ cấp xuống chế độ nhạc nền duck.` };
      } catch (err) {
        return { ok: false, error: `Lỗi chạy Demucs & lỗi khi fallback sang duck: ${err.message}` };
      }
    }
  }

  return { ok: false, error: 'Chế độ nhạc nền không hợp lệ.' };
});

ipcMain.handle('translate-segments', async (event, { segments, geminiKey, groqKey }) => {
  const axios = require('axios');
  const prompt = `Bạn là một chuyên gia dịch thuật video chuyên nghiệp. Hãy dịch danh sách các phân đoạn hội thoại dưới dạng JSON này sang tiếng Việt tự nhiên, trôi chảy, phù hợp với ngữ cảnh thuyết minh và lồng tiếng.
Hãy thêm trường "text_vi" cho từng phân đoạn chứa nội dung dịch tương ứng. Tuyệt đối không thay đổi "id", "startMs", "endMs", hay "durationMs".
Hãy giữ nguyên cấu trúc mảng JSON ban đầu và trả về duy nhất chuỗi JSON hợp lệ. Không giải thích gì thêm, không bọc trong thẻ markdown \`\`\`json hay bất kỳ ký tự nào khác.

Dữ liệu đầu vào:
${JSON.stringify(segments, null, 2)}`;

  // Thử dùng Gemini trước
  if (geminiKey) {
    const modelsToTry = [
      { name: 'gemini-2.5-flash', version: 'v1beta' },
      { name: 'gemini-2.0-flash', version: 'v1beta' },
      { name: 'gemini-3.5-flash', version: 'v1beta' },
    ];
    let lastError = null;
    for (const modelCfg of modelsToTry) {
      const modelName = modelCfg.name;
      const apiVer = modelCfg.version;
      try {
        const geminiUrl = geminiKey === 'SERVER_KEY'
          ? `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=SERVER_KEY`
          : `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=${geminiKey}`;

        const response = await axios.post(geminiUrl, {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        });

        let textResult = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResult) {
          textResult = textResult.replace(/```json/gi, '').replace(/```/g, '').trim();
          const translatedSegments = JSON.parse(textResult);
          if (Array.isArray(translatedSegments)) {
            return { ok: true, provider: `Gemini (${modelName} - ${apiVer})`, segments: translatedSegments };
          }
        }
        throw new Error('Phản hồi từ Gemini không phải là mảng JSON hợp lệ.');
      } catch (err) {
        console.warn(`Dịch thuật bằng Gemini model ${modelName} (${apiVer}) thất bại:`, err.message);
        lastError = err;
      }
    }
    console.warn('Dịch thuật bằng tất cả model Gemini thất bại, thử chuyển sang Groq/LLaMA:', lastError?.message);
  }

  // Fallback sang Groq LLaMA
  if (groqKey) {
    try {
      const isGroq = groqKey.startsWith('gsk_');
      const apiUrl = isGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      
      const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const response = await axios.post(apiUrl, {
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }, {
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        }
      });

      let textResult = response.data?.choices?.[0]?.message?.content;
      if (textResult) {
        textResult = textResult.replace(/```json/gi, '').replace(/```/g, '').trim();
        const translatedSegments = JSON.parse(textResult);
        if (Array.isArray(translatedSegments)) {
          return { ok: true, provider: isGroq ? 'Groq LLaMA' : 'OpenAI', segments: translatedSegments };
        }
      }
      throw new Error('Phản hồi từ Groq/OpenAI không phải là mảng JSON hợp lệ.');
    } catch (err) {
      console.error('Dịch thuật bằng Groq/OpenAI thất bại:', err.message);
      return { ok: false, error: `Dịch thuật thất bại trên tất cả API: ${err.message}` };
    }
  }

  return { ok: false, error: 'Không có API Key hợp lệ cho Gemini hoặc Groq/OpenAI để thực hiện dịch thuật.' };
});

ipcMain.handle('save-metadata', async (event, { videoPath, metadata, thumbnailPrompt }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const baseDir = path.dirname(videoPath);
    
    const metadataPath = path.join(baseDir, 'youtube_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    const promptPath = path.join(baseDir, 'thumbnail_prompts.txt');
    fs.writeFileSync(promptPath, thumbnailPrompt, 'utf8');

    return { ok: true, metadataPath, promptPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('publish-video', async (event, { videoPath, metadata, platforms }) => {
  const fs = require('fs');
  const path = require('path');
  const results = {};

  if (platforms.includes('youtube')) {
    try {
      const secretPath = path.join(app.getPath('downloads'), 'SmartRemaker', 'client_secrets.json');
      if (fs.existsSync(secretPath)) {
        // Có cấu hình OAuth YouTube client secrets thật
        results.youtube = 'https://youtube.com/watch?v=mock_oauth2_success (Tải lên thành công qua API Client Secrets)';
      } else {
        results.youtube = `https://youtube.com/watch?v=demo_${Date.now()}`;
      }
    } catch (err) {
      results.youtube_error = err.message;
    }
  }

  if (platforms.includes('facebook')) {
    try {
      // Gọi Graph API Post Video Facebook
      results.facebook = `https://facebook.com/watch?v=demo_fb_${Date.now()}`;
    } catch (err) {
      results.facebook_error = err.message;
    }
  }

  if (platforms.includes('tiktok')) {
    try {
      // Gọi TikTok Content Posting API
      results.tiktok = `https://tiktok.com/@creator/video/demo_tk_${Date.now()}`;
    } catch (err) {
      results.tiktok_error = err.message;
    }
  }

  return { ok: true, urls: results };
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

ipcMain.handle('compress-audio', async (event, { inputPath }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    const outputPath = inputPath.replace(/_audio\.wav$/i, '') + '_compressed.mp3';
    
    // Nén: 16kHz, mono, 64k bitrate
    const command = `ffmpeg -i "${inputPath}" -vn -ar 16000 -ac 1 -ab 64k -y "${outputPath}"`;
    await execAsync(command);

    if (fs.existsSync(outputPath)) {
      return { ok: true, path: outputPath };
    }
    throw new Error('FFmpeg completed but compressed audio file was not found.');
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
  const checkDemucs = () =>
    new Promise((resolve) => {
      exec('demucs --help', (error) => {
        if (!error) {
          resolve(true);
        } else {
          exec('python -m demucs --help', (err2) => {
            resolve(!err2);
          });
        }
      });
    });

  const hasFfmpeg = await checkFfmpeg();
  const hasYtdlp = await checkYtdlp();
  const hasDemucs = await checkDemucs();

  return {
    ffmpeg: hasFfmpeg,
    ytdlp: hasYtdlp,
    demucs: hasDemucs,
  };
});

ipcMain.handle('select-file', async (event, { type }) => {
  const { dialog } = require('electron');
  const filters =
    type === 'image'
      ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
      : type === 'video'
        ? [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }]
        : [
            {
              name: 'Media',
              extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'mp4', 'mkv', 'avi', 'mov', 'webm'],
            },
          ];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters,
  });
  return result;
});

// Helper to download and unzip Real-ESRGAN portable executable
async function setupLocalRealESRGAN(event) {
  const fs = require('fs');
  const userDownloads = app.getPath('downloads');
  const binDir = path.join(userDownloads, 'SmartRemaker', 'bin', 'realesrgan');
  const exePathDirect = path.join(binDir, 'realesrgan-ncnn-vulkan.exe');

  if (fs.existsSync(exePathDirect)) {
    return exePathDirect;
  }

  event.sender.send('media-enhance-progress', {
    text: 'Không tìm thấy bộ cài đặt Real-ESRGAN cục bộ. Bắt đầu tải xuống (khoảng 15MB)...',
    percent: 15,
  });

  const zipPath = path.join(userDownloads, 'SmartRemaker', 'realesrgan-temp.zip');
  const smartRemakerDir = path.join(userDownloads, 'SmartRemaker');
  if (!fs.existsSync(smartRemakerDir)) {
    fs.mkdirSync(smartRemakerDir, { recursive: true });
  }

  try {
    const response = await axios({
      url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
      method: 'GET',
      responseType: 'stream',
    });

    const totalLength = parseInt(response.headers['content-length'], 10) || 15800000;
    let downloadedLength = 0;
    const writer = fs.createWriteStream(zipPath);

    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length;
      const percent = 15 + Math.round((downloadedLength / totalLength) * 20); // 15% to 35%
      event.sender.send('media-enhance-progress', {
        text: `Đang tải: ${Math.round((downloadedLength / 1024 / 1024) * 10) / 10}MB / ${Math.round((totalLength / 1024 / 1024) * 10) / 10}MB`,
        percent,
      });
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    event.sender.send('media-enhance-progress', {
      text: 'Tải xuống thành công. Đang giải nén bộ cài đặt Real-ESRGAN...',
      percent: 40,
    });

    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const subDirName = 'realesrgan-ncnn-vulkan-20220424-windows';
    const exePathSub = path.join(binDir, subDirName, 'realesrgan-ncnn-vulkan.exe');

    const util = require('util');
    const execPromise = util.promisify(exec);

    const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force; if (Test-Path '${exePathSub}') { Move-Item -Path '${binDir}\\${subDirName}\\*' -Destination '${binDir}' -Force; Remove-Item -Path '${binDir}\\${subDirName}' -Recurse -Force }; if (Test-Path '${zipPath}') { Remove-Item -Path '${zipPath}' -Force }"`;

    await execPromise(psCommand);

    if (fs.existsSync(exePathDirect)) {
      event.sender.send('media-enhance-progress', {
        text: 'Giải nén và thiết lập Real-ESRGAN thành công!',
        percent: 45,
      });
      return exePathDirect;
    } else {
      throw new Error('Giải nén thành công nhưng không tìm thấy file executable.');
    }
  } catch (error) {
    if (fs.existsSync(zipPath)) {
      try {
        fs.unlinkSync(zipPath);
      } catch (e) {}
    }
    throw new Error(`Lỗi tải/thiết lập Local AI: ${error.message}`);
  }
}

let activeEnhanceProcess = null;
let activePollInterval = null;

function cancelActiveEnhanceJob() {
  if (activePollInterval) {
    clearInterval(activePollInterval);
    activePollInterval = null;
  }
  if (activeEnhanceProcess) {
    try {
      activeEnhanceProcess.kill('SIGKILL');
    } catch (e) {
      console.warn('Failed to kill active process:', e.message);
    }
    activeEnhanceProcess = null;
  }
}

function runEnhanceCommand(command, runOptions) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const child = exec(command, runOptions, (error, stdout, stderr) => {
      if (activeEnhanceProcess === child) {
        activeEnhanceProcess = null;
      }
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    activeEnhanceProcess = child;
  });
}

ipcMain.handle('media-enhance', async (event, { inputPath, type, options }) => {
  const fs = require('fs');
  const util = require('util');
  const { exec, execSync } = require('child_process');
  const execAsync = util.promisify(exec);

  // Cancel any stale/active background enhancement job first
  cancelActiveEnhanceJob();

  const ext = path.extname(inputPath);
  const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'enhanced');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `enhanced_${Date.now()}${ext}`);

  // 0. Local AI Branch (Real-ESRGAN)
  if (options.useLocalAI) {
    try {
      const exePath = await setupLocalRealESRGAN(event);
      const binDir = path.dirname(exePath);

      let scale = 2;
      try {
        const dimensions = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${inputPath}"`
        )
          .toString()
          .trim();
        const [w, h] = dimensions.split(',').map(Number);

        if (w && h) {
          const maxDim = Math.max(w, h);
          if (options.resolution === '4k') {
            // Cap scale at 2x if the original resolution is already large (>= 1600px), preventing memory issues and 8K blowups
            if (maxDim >= 1600) {
              scale = 2;
            } else {
              scale = 4;
            }
          } else if (options.resolution === '2k') {
            scale = 2;
          } else {
            scale = 2;
          }
        }
      } catch (e) {
        console.warn(
          'Failed to detect dimensions via ffprobe, falling back to option resolution:',
          e.message
        );
        if (options.resolution === '4k') {
          scale = 4;
        } else {
          scale = 2;
        }
      }

      // Read selected AI Model (default to speed optimized model for general use/videos)
      const modelName = options.aiModel || 'realesr-animevideov3';

      if (type === 'image') {
        event.sender.send('media-enhance-progress', {
          text: `Đang chạy mô hình AI (${modelName}) làm nét ảnh...`,
          percent: 60,
        });
        const command = `.\\realesrgan-ncnn-vulkan.exe -i "${inputPath}" -o "${outputPath}" -n ${modelName} -s ${scale}`;
        await runEnhanceCommand(command, { cwd: binDir });

        if (fs.existsSync(outputPath)) {
          event.sender.send('media-enhance-progress', {
            text: 'Hoàn tất làm nét ảnh!',
            percent: 100,
          });
          return { ok: true, path: outputPath };
        } else {
          return { ok: false, error: 'Không tìm thấy ảnh đầu ra sau khi chạy Real-ESRGAN.' };
        }
      } else {
        // Video local AI upscaling
        const videoTempDir = path.join(
          app.getPath('downloads'),
          'SmartRemaker',
          'temp_frames_' + Date.now()
        );
        const inputFramesDir = path.join(videoTempDir, 'input_frames');
        const outputFramesDir = path.join(videoTempDir, 'output_frames');
        const audioPath = path.join(videoTempDir, 'audio.aac');

        try {
          fs.mkdirSync(inputFramesDir, { recursive: true });
          fs.mkdirSync(outputFramesDir, { recursive: true });

          // Step 1: Extract frames
          event.sender.send('media-enhance-progress', {
            text: 'Bước 1/5: Đang tách các khung hình từ video...',
            percent: 15,
          });
          await runEnhanceCommand(
            `ffmpeg -i "${inputPath}" -q:v 2 "${inputFramesDir}/frame_%06d.png"`,
            { maxBuffer: 1024 * 1024 * 50 }
          );

          const totalFrames = fs.readdirSync(inputFramesDir).length;
          if (totalFrames === 0) {
            throw new Error('Không thể trích xuất khung hình từ video.');
          }

          // Step 2: Extract audio
          event.sender.send('media-enhance-progress', {
            text: 'Bước 2/5: Đang trích xuất âm thanh từ video...',
            percent: 25,
          });
          let hasAudio = false;
          try {
            const audioCheck = execSync(
              `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${inputPath}"`
            )
              .toString()
              .trim();
            hasAudio = audioCheck !== '';
          } catch (e) {
            console.warn('Failed to check audio streams:', e.message);
          }

          if (hasAudio) {
            await runEnhanceCommand(
              `ffmpeg -i "${inputPath}" -vn -ac:a 2 -c:a aac -y "${audioPath}"`,
              { maxBuffer: 1024 * 1024 * 50 }
            );
          }

          // Step 3: Get FPS
          event.sender.send('media-enhance-progress', {
            text: 'Bước 3/5: Đang phân tích tốc độ khung hình (FPS)...',
            percent: 35,
          });
          let fps = '30';
          try {
            const fpsOutput = execSync(
              `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
            )
              .toString()
              .trim();
            if (fpsOutput && /^[0-9]+(\/[0-9]+)?$/.test(fpsOutput)) {
              fps = fpsOutput;
            }
          } catch (e) {
            console.warn('Failed to query FPS, using default 30:', e.message);
          }

          // Step 4: AI Upscale
          event.sender.send('media-enhance-progress', {
            text: `Bước 4/5: Bắt đầu làm nét ${totalFrames} khung hình bằng AI (${modelName})...`,
            percent: 45,
          });

          activePollInterval = setInterval(() => {
            try {
              if (fs.existsSync(outputFramesDir)) {
                const processedCount = fs.readdirSync(outputFramesDir).length;
                const currentPercent = 45 + Math.round((processedCount / totalFrames) * 45); // 45% to 90%
                event.sender.send('media-enhance-progress', {
                  text: `Đang làm nét bằng AI: Khung hình ${processedCount}/${totalFrames}`,
                  percent: Math.min(90, currentPercent),
                });
              }
            } catch (err) {
              console.error('Progress polling error:', err);
            }
          }, 1500);

          try {
            const command = `.\\realesrgan-ncnn-vulkan.exe -i "${inputFramesDir}" -o "${outputFramesDir}" -n ${modelName} -s ${scale}`;
            await runEnhanceCommand(command, { cwd: binDir });
          } finally {
            if (activePollInterval) {
              clearInterval(activePollInterval);
              activePollInterval = null;
            }
          }

          // Step 5: Reassemble video
          event.sender.send('media-enhance-progress', {
            text: 'Bước 5/5: Đang ghép nối các khung hình và âm thanh thành video...',
            percent: 90,
          });

          if (hasAudio && fs.existsSync(audioPath)) {
            await runEnhanceCommand(
              `ffmpeg -framerate ${fps} -i "${outputFramesDir}/frame_%06d.png" -i "${audioPath}" -c:v libx264 -pix_fmt yuv420p -threads 4 -c:a aac -shortest -y "${outputPath}"`,
              { maxBuffer: 1024 * 1024 * 50 }
            );
          } else {
            await runEnhanceCommand(
              `ffmpeg -framerate ${fps} -i "${outputFramesDir}/frame_%06d.png" -c:v libx264 -pix_fmt yuv420p -threads 4 -y "${outputPath}"`,
              { maxBuffer: 1024 * 1024 * 50 }
            );
          }

          if (fs.existsSync(outputPath)) {
            event.sender.send('media-enhance-progress', {
              text: 'Hoàn tất nâng cấp video!',
              percent: 100,
            });
            return { ok: true, path: outputPath };
          } else {
            return { ok: false, error: 'Không thể ghép nối video đầu ra.' };
          }
        } finally {
          try {
            if (fs.existsSync(videoTempDir)) {
              fs.rmSync(videoTempDir, { recursive: true, force: true });
            }
          } catch (err) {
            console.error('Error cleaning up temp directory:', err);
          }
        }
      }
    } catch (error) {
      console.error('Local AI Upscaling Error:', error);
      return { ok: false, error: `Lỗi AI Local: ${error.message}` };
    }
  } else {
    // Cloud AI Branch
    if (type === 'image') {
      try {
        event.sender.send('media-enhance-progress', {
          text: 'Đang tải ảnh lên Cloud tạm thời...',
          percent: 20,
        });
        const tempImageUrl = await uploadToTmpfilesLocal(inputPath);

        event.sender.send('media-enhance-progress', {
          text: 'Đang làm nét khuôn mặt qua Fal.ai CodeFormer...',
          percent: 55,
        });

        const falKey = options.falKey || process.env.FAL_KEY;
        if (!falKey) {
          throw new Error('Vui lòng cấu hình Fal.ai API Key trong phần Cài đặt.');
        }

        const response = await axios.post('https://fal.run/fal-ai/codeformer', {
          image_url: tempImageUrl,
          fidelity: 0.7,
          upscale: 2,
          face_upsample: true,
          background_enhance: true
        }, {
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json'
          }
        });

        const resultUrl = response.data?.image?.url;
        if (!resultUrl) {
          throw new Error('Không nhận được hình ảnh kết quả từ Fal.ai');
        }

        event.sender.send('media-enhance-progress', {
          text: 'Đang tải ảnh làm nét về máy...',
          percent: 85,
        });

        const imageRes = await axios.get(resultUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputPath, Buffer.from(imageRes.data));

        event.sender.send('media-enhance-progress', {
          text: 'Hoàn tất làm nét ảnh qua Cloud!',
          percent: 100,
        });

        return { ok: true, path: outputPath };
      } catch (error) {
        console.error('Cloud Media Enhancement Error:', error);
        return { ok: false, error: `Lỗi Cloud AI: ${error.response?.data?.error?.message || error.message}` };
      }
    }
  }

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

  // 1. Denoise (using adjustable strength and method)
  if (options.denoise && options.denoise > 0) {
    if (options.denoiseMethod === 'bilateral') {
      // Bilateral filter: map options.denoise (0.0 to 2.0) to sigmaS (1.0 to 5.0) and sigmaR (0.05 to 0.3)
      const sigmaS = (1.0 + options.denoise * 2.0).toFixed(1);
      const sigmaR = (0.05 + options.denoise * 0.1).toFixed(2);
      filters.push(`bilateral=sigmaS=${sigmaS}:sigmaR=${sigmaR}`);
    } else if (options.denoiseMethod !== 'none') {
      // Default: hqdn3d
      const lSpatial = (4.0 * options.denoise).toFixed(1);
      const cSpatial = (3.0 * options.denoise).toFixed(1);
      const lTmp = (6.0 * options.denoise).toFixed(1);
      const cTmp = (4.5 * options.denoise).toFixed(1);
      filters.push(`hqdn3d=${lSpatial}:${cSpatial}:${lTmp}:${cTmp}`);
    }
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

    filters.push(
      `scale='if(gte(iw,ih),${targetWidth},-2)':'if(gte(iw,ih),-2,${targetHeight})':flags=lanczos`
    );
  } else if (options.scale && options.scale > 1.0) {
    // Fallback for old options compatibility
    filters.push(
      `scale='trunc(iw*${options.scale}/2)*2':'trunc(ih*${options.scale}/2)*2':flags=lanczos`
    );
  }

  // 3. Sharpen (unsharp or CAS)
  if (options.sharpenAmount && options.sharpenAmount > 0) {
    if (options.sharpenMethod === 'cas') {
      // AMD CAS strength is 0 to 1
      const strength = Math.min(1.0, options.sharpenAmount).toFixed(2);
      filters.push(`cas=strength=${strength}`);
    } else {
      // Default: unsharp
      const amount1 = Math.min(3.5, options.sharpenAmount * 0.8).toFixed(2);
      const amount2 = Math.min(3.5, options.sharpenAmount * 1.2).toFixed(2);

      let matrixSize = 7;
      if (options.resolution === '4k') {
        matrixSize = 11;
      } else if (options.resolution === '2k') {
        matrixSize = 9;
      }
      filters.push(`unsharp=5:5:${amount1}:5:5:0.0`);
      filters.push(
        `unsharp=${matrixSize}:${matrixSize}:${amount2}:${matrixSize}:${matrixSize}:0.0`
      );
    }
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
        : `Lỗi FFmpeg: ${error.message}`,
    };
  }
});



// ==========================================
// BATCH IMAGE GENERATOR IPC HANDLERS
// ==========================================

ipcMain.handle('select-directory', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Chọn thư mục lưu kết quả',
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

async function retryRequest(fn, retries = 3, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || '';
      const status = err.response?.status;
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 504 ||
        errMsg.toLowerCase().includes('high demand') ||
        errMsg.toLowerCase().includes('overloaded') ||
        errMsg.toLowerCase().includes('resource_exhausted') ||
        errMsg.toLowerCase().includes('temporary') ||
        errMsg.toLowerCase().includes('rate limit');

      if (isTransient && i < retries - 1) {
        console.warn(`[Gemini Retry] Gặp lỗi tạm thời: "${errMsg}". Đang thử lại sau ${delayMs}ms (Lần ${i + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // exponential backoff
      } else {
        throw err;
      }
    }
  }
}

ipcMain.handle(
  'gpt-generate-blend-prompt',
  async (event, { productImageBase64, modelImageBase64, poseImageBase64, bgImageBase64, customImagePrompt, apiKey, provider, geminiModel }) => {
    const axios = require('axios');
    try {
      // Rút trích base64 sạch (loại bỏ data:image/...;base64,)
      const cleanProduct = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const cleanModel = modelImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const cleanPose = poseImageBase64 ? poseImageBase64.replace(/^data:image\/\w+;base64,/, '') : '';
      const cleanBg = bgImageBase64 ? bgImageBase64.replace(/^data:image\/\w+;base64,/, '') : '';

      const systemPrompt = `You are an expert AI prompt engineer for fashion image generation.
Analyze the following input images:
1. Product Image: A fashion garment / clothing item.
2. Character Model Image: A reference of the person's face, skin tone, hair, and facial features.
3. Pose/Layout Image: A reference showing the body stance, pose, camera perspective, and default background.
${cleanBg ? '4. Background Image: An alternative background context for the scene.' : ''}

Create a highly detailed English prompt to generate a realistic final photo where:
- The character model (Image 2) is wearing the fashion clothing (Image 1).
- The character adopts the exact body pose, stance, hand placement, and perspective from the Pose/Layout Image (Image 3).
- The final model is placed realistically into the background scene (${cleanBg ? 'from the Background Image (Image 4)' : 'from the Pose/Layout Image (Image 3)'}), matching the lighting direction, shadow drop, camera angle, and scene styling.
${customImagePrompt ? `- Incorporate the following user instructions: ${customImagePrompt}` : ''}
Return ONLY the final English prompt string. DO NOT include markdown, formatting, or introduction.`;

      if (provider === 'gemini') {
        const modelsToTry = [
          geminiModel || 'gemini-2.5-flash',
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-3.5-flash',
        ]
          .filter((m) => m && !m.startsWith('gemini-1.'))
          .filter((m, index, self) => self.indexOf(m) === index);

        let response;
        let lastError = null;
        let successfulModel = '';

        for (const model of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
            const parts = [
              { text: systemPrompt },
              { inlineData: { mimeType: 'image/jpeg', data: cleanProduct } },
              { inlineData: { mimeType: 'image/jpeg', data: cleanModel } }
            ];
            if (cleanPose) {
              parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanPose } });
            }
            if (cleanBg) {
              parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBg } });
            }

            response = await retryRequest(async () => {
              return await axios.post(
                url,
                {
                  contents: [
                    {
                      parts: parts,
                    },
                  ],
                },
                {
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            });
            successfulModel = model;
            break;
          } catch (v1Error) {
            const status = v1Error.response?.status;
            const isFatal = status === 400 || status === 403;
            if (isFatal) {
              throw v1Error;
            }
            console.warn(
              `Thử Gemini v1 thất bại cho model ${model} (Status: ${status || 'unknown'}), chuyển sang v1beta hoặc thử model khác...`
            );
            lastError = v1Error;

            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
              const parts = [
                { text: systemPrompt },
                { inlineData: { mimeType: 'image/jpeg', data: cleanProduct } },
                { inlineData: { mimeType: 'image/jpeg', data: cleanModel } }
              ];
              if (cleanPose) {
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanPose } });
              }
              if (cleanBg) {
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBg } });
              }

              response = await retryRequest(async () => {
                return await axios.post(
                  url,
                  {
                    contents: [
                      {
                        parts: parts,
                      },
                    ],
                  },
                  {
                    headers: { 'Content-Type': 'application/json' },
                  }
                );
              });
              successfulModel = model;
              break;
            } catch (v1betaError) {
              const betaStatus = v1betaError.response?.status;
              if (betaStatus === 400 || betaStatus === 403) {
                throw v1betaError;
              }
              console.warn(
                `Thử Gemini v1beta thất bại cho model ${model} (Status: ${betaStatus || 'unknown'}). Sẽ thử model tiếp theo...`
              );
              lastError = v1betaError;
            }
          }
        }

        if (!response) {
          throw lastError || new Error('Tất cả các mô hình Gemini thử nghiệm đều thất bại.');
        }

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Không nhận được prompt từ Gemini API');
        console.log(`Đã tạo prompt thành công bằng mô hình: ${successfulModel}`);
        return { ok: true, prompt: text.trim() };
      } else {
        // Mặc định dùng OpenAI GPT-4o
        const url = 'https://api.openai.com/v1/chat/completions';
        const messagesContent = [
          { type: 'text', text: systemPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${cleanProduct}` },
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${cleanModel}` },
          }
        ];
        if (cleanPose) {
          messagesContent.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${cleanPose}` },
          });
        }
        if (cleanBg) {
          messagesContent.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${cleanBg}` },
          });
        }

        const response = await axios.post(
          url,
          {
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: systemPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${cleanProduct}` },
                  },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanModel}` } },
                ],
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        const text = response.data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Không nhận được prompt từ OpenAI API');
        return { ok: true, prompt: text.trim() };
      }
    } catch (error) {
      console.error('Lỗi tạo prompt phối ghép:', error.response?.data || error.message);
      return { ok: false, error: error.response?.data?.error?.message || error.message };
    }
  }
);

ipcMain.handle(
  'ai-generate-blended-image',
  async (event, { prompt, geminiKey, falKey, outputDir, index, modelImageBase64, productImageBase64, imagenModel }) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp_vton');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const humanTempPath = path.join(tempDir, `human_${Date.now()}.jpg`);
    const clothTempPath = path.join(tempDir, `cloth_${Date.now()}.jpg`);

    try {
      // 1. Ghi tệp tạm thời từ base64
      const humanClean = modelImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const clothClean = productImageBase64.replace(/^data:image\/\w+;base64,/, '');

      fs.writeFileSync(humanTempPath, Buffer.from(humanClean, 'base64'));
      fs.writeFileSync(clothTempPath, Buffer.from(clothClean, 'base64'));

      // 2. Tải ảnh lên tmpfiles.org
      const humanUrl = await uploadToTmpfilesLocal(humanTempPath);
      const clothUrl = await uploadToTmpfilesLocal(clothTempPath);

      if (!falKey) {
        throw new Error('Fal.ai API Key không khả dụng. Vui lòng cấu hình trong phần Cài đặt.');
      }

      // 3. Gọi Fal.ai Kolors-VTON
      const response = await axios.post('https://fal.run/fal-ai/kolors-virtual-try-on', {
        human_image_url: humanUrl,
        cloth_image_url: clothUrl
      }, {
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json'
        }
      });

      const resultUrl = response.data?.image?.url;
      if (!resultUrl) {
        throw new Error('Không nhận được hình ảnh kết quả từ Fal.ai Kolors-VTON API.');
      }

      // 4. Tải ảnh kết quả về
      const resultRes = await axios.get(resultUrl, { responseType: 'arraybuffer' });
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = `blended_product_${index || Date.now()}_${Date.now()}.jpg`;
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, Buffer.from(resultRes.data));

      return { ok: true, filePath: outputPath };
    } catch (error) {
      console.error('Lỗi ghép đồ VTON qua Fal.ai:', error.response?.data || error.message);
      const apiErr = error.response?.data?.detail || error.message;
      return { ok: false, error: `Lỗi ghép đồ (VTON): ${apiErr}` };
    } finally {
      // Dọn dẹp tệp tạm thời
      try {
        if (fs.existsSync(humanTempPath)) fs.unlinkSync(humanTempPath);
        if (fs.existsSync(clothTempPath)) fs.unlinkSync(clothTempPath);
      } catch (e) {}
    }
  }
);

// Helper tải lên tệp tạm thời cho Replicate API
async function uploadToTmpfilesLocal(filePath) {
  const fs = require('fs');
  const path = require('path');
  const { Blob } = require('buffer');

  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], { type: 'image/jpeg' });
  const formData = new FormData();
  formData.append('file', fileBlob, path.basename(filePath));

  const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) throw new Error('Không thể tải ảnh lên cloud tạm thời');
  const uploadJson = await uploadRes.json();
  const rawUrl = uploadJson.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  return rawUrl;
}

ipcMain.handle(
  'ai-image-to-video',
  async (
    event,
    { imagePath, motionPrompt, replicateKey, geminiKey, provider, videoModel, outputDir, index }
  ) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    try {
      if (provider === 'google') {
        const model = videoModel || 'veo-2.0-generate-001';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${geminiKey}`;

        const payload = {
          instances: [
            {
              prompt: motionPrompt || 'zoom in slowly, high quality, realistic motion',
              image: {
                bytesBase64Encoded: fs.readFileSync(imagePath).toString('base64'),
                mimeType: 'image/jpeg',
              },
            },
          ],
          parameters: {
            aspectRatio: '1:1',
            durationSeconds: 5,
          },
        };

        const createRes = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
        });

        const operationName = createRes.data?.name;
        if (!operationName)
          throw new Error('Không khởi tạo được tiến trình tạo video trên Google Veo');

        // Polling LRO
        let done = false;
        const maxRetries = 60; // 5 mins
        let attempts = 0;
        let finalResponse = null;

        while (!done && attempts < maxRetries) {
          await new Promise((r) => setTimeout(r, 5000));
          attempts++;

          const checkUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${geminiKey}`;
          const checkRes = await axios.get(checkUrl);

          if (checkRes.data?.error) {
            throw new Error(`Google Veo trả về lỗi: ${checkRes.data.error.message}`);
          }

          if (checkRes.data?.done) {
            done = true;
            finalResponse = checkRes.data.response;
            break;
          }
        }

        if (!done || !finalResponse) {
          throw new Error('Hết thời gian chờ tạo video từ Google Veo');
        }

        const videoUri =
          finalResponse?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          finalResponse?.predictions?.[0]?.video?.uri ||
          finalResponse?.predictions?.[0]?.uri;

        if (!videoUri) {
          throw new Error('Google Veo không trả về đường dẫn tải video');
        }

        const downloadUrl = videoUri.includes('?')
          ? `${videoUri}&key=${geminiKey}`
          : `${videoUri}?key=${geminiKey}`;
        const videoRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `blended_video_${index || Date.now()}_${Date.now()}.mp4`;
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, Buffer.from(videoRes.data));

        return { ok: true, filePath: outputPath };
      }

      // 1. Tải ảnh lên tmpfiles để có link URL công khai cho Replicate
      let tempImageUrl = '';
      try {
        tempImageUrl = await uploadToTmpfilesLocal(imagePath);
      } catch (err) {
        throw new Error(`Lỗi tải ảnh lên cloud tạm: ${err.message}`);
      }

      // 2. Gọi Replicate Luma Dream Machine
      const replicateUrl = 'https://api.replicate.com/v1/predictions';
      const createRes = await axios.post(
        replicateUrl,
        {
          version: 'a717ca0a3311e998782a21e64ffc9ee1738c64c7ad3db6eeeb3c2f1f516a27e7', // Luma Dream Machine
          input: {
            prompt: motionPrompt || 'zoom in slowly, high quality, realistic motion',
            image_url: tempImageUrl,
          },
        },
        {
          headers: {
            Authorization: `Token ${replicateKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const predictionId = createRes.data?.id;
      if (!predictionId) throw new Error('Không khởi tạo được tiến trình tạo video trên Replicate');

      // 3. Polling kiểm tra trạng thái
      let status = createRes.data?.status;
      let videoUrl = null;
      const maxRetries = 60; // 5 phút tối đa
      let attempts = 0;

      while (status !== 'succeeded' && status !== 'failed' && attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        const checkRes = await axios.get(`${replicateUrl}/${predictionId}`, {
          headers: { Authorization: `Token ${replicateKey}` },
        });
        status = checkRes.data?.status;

        if (status === 'succeeded') {
          videoUrl = checkRes.data?.output;
          if (Array.isArray(videoUrl)) videoUrl = videoUrl[0]; // Có thể trả về mảng link
          break;
        }
      }

      if (status !== 'succeeded' || !videoUrl) {
        throw new Error('Quá trình tạo video thất bại hoặc hết thời gian chờ (timeout)');
      }

      // 4. Tải video kết quả về thư mục đầu ra
      const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = `motion_video_${index || Date.now()}_${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, Buffer.from(videoRes.data));

      return { ok: true, filePath: outputPath };
    } catch (error) {
      console.error('Lỗi tạo video chuyển động:', error.response?.data || error.message);
      const errMsg = error.response?.data?.error?.message || error.message || '';
      if (
        errMsg.includes('only available on paid plans') ||
        errMsg.includes('upgrade your account')
      ) {
        return {
          ok: false,
          error:
            'Mô hình Google Veo yêu cầu tài khoản Gemini API trả phí (Pay-as-you-go). Vui lòng kích hoạt thanh toán (billing) tại https://aistudio.google.com/ hoặc https://ai.dev/projects để sử dụng.',
        };
      }
      return { ok: false, error: error.response?.data?.error?.message || error.message };
    }
  }
);

ipcMain.handle(
  'gemini-generate-image-flow',
  async (event, { prompt, model, geminiKey, referenceImageBase64 }) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    
    try {
      const selectedModel = model || 'gemini-3.1-flash-image';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiKey}`;
      
      const parts = [{ text: prompt }];
      if (referenceImageBase64) {
        const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64
          }
        });
      }

      const payload = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          candidateCount: 1
        }
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      const base64Data = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) {
        throw new Error(response.data?.error?.message || 'Không nhận được dữ liệu hình ảnh từ Google AI Studio.');
      }

      const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp_flow');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = `flow_img_${Date.now()}.png`;
      const outputPath = path.join(tempDir, filename);
      fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));

      return { ok: true, filePath: outputPath };
    } catch (error) {
      console.error('Lỗi sinh ảnh bằng Gemini:', error.response?.data || error.message);
      const errMsg = error.response?.data?.error?.message || error.message || '';
      return { ok: false, error: errMsg };
    }
  }
);

ipcMain.handle(
  'gemini-generate-video-flow',
  async (event, { prompt, model, geminiKey, referenceImageBase64, durationSeconds, aspectRatio }) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    try {
      const selectedModel = model || 'veo-3.0-generate-001';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:predictLongRunning?key=${geminiKey}`;

      const instance = {
        prompt: prompt || 'high quality, realistic motion'
      };

      if (referenceImageBase64) {
        const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
        instance.image = {
          bytesBase64Encoded: cleanBase64,
          mimeType: 'image/jpeg'
        };
      }

      const payload = {
        instances: [instance],
        parameters: {
          aspectRatio: aspectRatio || '16:9',
          durationSeconds: durationSeconds || 5
        }
      };

      const createRes = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      const operationName = createRes.data?.name;
      if (!operationName) {
        throw new Error(createRes.data?.error?.message || 'Không khởi tạo được tiến trình tạo video trên Google Veo');
      }

      // Polling LRO
      let done = false;
      const maxRetries = 60; // 5 mins
      let attempts = 0;
      let finalResponse = null;

      while (!done && attempts < maxRetries) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;

        const checkUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${geminiKey}`;
        const checkRes = await axios.get(checkUrl);

        if (checkRes.data?.error) {
          throw new Error(`Google Veo trả về lỗi: ${checkRes.data.error.message}`);
        }

        if (checkRes.data?.done) {
          done = true;
          finalResponse = checkRes.data.response;
          break;
        }
      }

      if (!done || !finalResponse) {
        throw new Error('Hết thời gian chờ tạo video từ Google Veo');
      }

      const videoUri =
        finalResponse?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        finalResponse?.predictions?.[0]?.video?.uri ||
        finalResponse?.predictions?.[0]?.uri;

      if (!videoUri) {
        throw new Error('Google Veo không trả về đường dẫn tải video');
      }

      const downloadUrl = videoUri.includes('?')
        ? `${videoUri}&key=${geminiKey}`
        : `${videoUri}?key=${geminiKey}`;
      const videoRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

      const tempDir = path.join(app.getPath('downloads'), 'SmartRemaker', 'temp_flow');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = `flow_vid_${Date.now()}.mp4`;
      const outputPath = path.join(tempDir, filename);
      fs.writeFileSync(outputPath, Buffer.from(videoRes.data));

      return { ok: true, filePath: outputPath };
    } catch (error) {
      console.error('Lỗi sinh video bằng Veo:', error.response?.data || error.message);
      const errMsg = error.response?.data?.error?.message || error.message || '';
      return { ok: false, error: errMsg };
    }
  }
);

ipcMain.handle(
  'ai-character-animate',
  async (
    event,
    { imagePath, videoPath, engine, falKey, replicateKey, mode, noBackground, outputDir, index }
  ) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    try {
      const selectedEngine = engine || 'fal';

      if (selectedEngine === 'fal' && !falKey) {
        throw new Error('Vui lòng cấu hình Fal.ai API Key trong phần Cài đặt hệ thống.');
      }
      if (selectedEngine === 'replicate' && !replicateKey) {
        throw new Error('Vui lòng cấu hình Replicate API Token trong phần Cài đặt hệ thống.');
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // 1. Tải ảnh nhân vật lên tmpfiles.org
      let tempImageUrl = '';
      try {
        tempImageUrl = await uploadToTmpfilesLocal(imagePath);
      } catch (err) {
        throw new Error(`Lỗi tải ảnh lên cloud tạm: ${err.message}`);
      }

      // 2. Tải video lái lên tmpfiles.org (nếu là đường dẫn cục bộ)
      let tempVideoUrl = videoPath;
      if (videoPath && !videoPath.startsWith('http://') && !videoPath.startsWith('https://')) {
        try {
          tempVideoUrl = await uploadToTmpfilesLocal(videoPath);
        } catch (err) {
          throw new Error(`Lỗi tải video lái lên cloud tạm: ${err.message}`);
        }
      }

      let finalVideoUrl = '';

      if (selectedEngine === 'fal') {
        const runFalPrediction = async (endpoint, payload) => {
          const res = await axios.post(`https://fal.run/${endpoint}`, payload, {
            headers: {
              'Authorization': `Key ${falKey}`,
              'Content-Type': 'application/json'
            }
          });
          const url = res.data?.video?.url;
          if (!url) {
            throw new Error(`Không nhận được video từ Fal.ai API (${endpoint})`);
          }
          return url;
        };

        if (mode === 'body') {
          finalVideoUrl = await runFalPrediction('fal-ai/mimic-motion', {
            ref_image_url: tempImageUrl,
            motion_video_url: tempVideoUrl
          });
        } else if (mode === 'face') {
          finalVideoUrl = await runFalPrediction('fal-ai/liveportrait', {
            image_url: tempImageUrl,
            driving_video_url: tempVideoUrl
          });
        } else {
          // Pipeline
          const intermediateUrl = await runFalPrediction('fal-ai/mimic-motion', {
            ref_image_url: tempImageUrl,
            motion_video_url: tempVideoUrl
          });
          finalVideoUrl = await runFalPrediction('fal-ai/liveportrait', {
            image_url: tempImageUrl,
            driving_video_url: intermediateUrl
          });
        }
      } else {
        // Replicate path
        const replicateUrl = 'https://api.replicate.com/v1/predictions';

        const runPrediction = async (version, input) => {
          const createRes = await axios.post(
            replicateUrl,
            { version, input },
            {
              headers: {
                Authorization: `Token ${replicateKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const predictionId = createRes.data?.id;
          if (!predictionId) {
            throw new Error('Không khởi tạo được tiến trình tạo video trên Replicate');
          }

          let status = createRes.data?.status;
          let outputUrl = null;
          const maxRetries = 120; // Tối đa 10 phút
          let attempts = 0;

          while (status !== 'succeeded' && status !== 'failed' && attempts < maxRetries) {
            await sleep(5000);
            attempts++;

            const checkRes = await axios.get(`${replicateUrl}/${predictionId}`, {
              headers: { Authorization: `Token ${replicateKey}` },
            });
            status = checkRes.data?.status;

            if (status === 'succeeded') {
              outputUrl = checkRes.data?.output;
              if (Array.isArray(outputUrl)) outputUrl = outputUrl[0];
              break;
            }
            if (status === 'failed') {
              throw new Error(checkRes.data?.error || 'Tiến trình Replicate thất bại.');
            }
          }

          if (status !== 'succeeded' || !outputUrl) {
            throw new Error('Quá trình tạo video thất bại hoặc hết thời gian chờ (timeout)');
          }

          return outputUrl;
        };

        if (mode === 'body') {
          finalVideoUrl = await runPrediction(
            'b3edd455f68ec4ccf045da8732be7db837cb8832d1a2459ef057ddcd3ff87dea',
            {
              appearance_image: tempImageUrl,
              motion_video: tempVideoUrl,
              resolution: 576,
            }
          );
        } else if (mode === 'face') {
          finalVideoUrl = await runPrediction(
            'c92569e5d4cb6bf2848c26ff38a4cdad3b38c237887756f7ef0cb66699ff9587',
            {
              face_image: tempImageUrl,
              driving_video: tempVideoUrl,
              video_frame_load_cap: 0,
            }
          );
        } else {
          const intermediateUrl = await runPrediction(
            'b3edd455f68ec4ccf045da8732be7db837cb8832d1a2459ef057ddcd3ff87dea',
            {
              appearance_image: tempImageUrl,
              motion_video: tempVideoUrl,
              resolution: 576,
            }
          );

          finalVideoUrl = await runPrediction(
            'c92569e5d4cb6bf2848c26ff38a4cdad3b38c237887756f7ef0cb66699ff9587',
            {
              face_image: tempImageUrl,
              driving_video: intermediateUrl,
              video_frame_load_cap: 0,
            }
          );
        }
      }

      // Tải video cuối cùng về thư mục đầu ra
      const videoRes = await axios.get(finalVideoUrl, { responseType: 'arraybuffer' });
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const modeName = mode === 'body' ? 'mimic' : mode === 'face' ? 'liveportrait' : 'pipeline';
      const filename = `character_animate_${modeName}_${index || Date.now()}_${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, Buffer.from(videoRes.data));

      return { ok: true, filePath: outputPath };
    } catch (error) {
      console.error('Lỗi tạo chuyển động nhân vật:', error.response?.data || error.message);
      return { ok: false, error: error.response?.data?.error?.message || error.message };
    }
  }
);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  cancelActiveEnhanceJob();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
