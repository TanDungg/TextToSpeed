// src/_hook/useVideoRemaker.js
import { useState, useEffect } from 'react';
import { message } from 'antd';
import VideoRemakerService from '../_service/videoRemaker.service';
import TTSProvider from '../_service/TTSProvider';

const convertVttToSrt = (vttText) => {
  if (!vttText) return '';
  return vttText
    .replace(/^WEBVTT\r?\n(Kind:.*\r?\n)?(Language:.*\r?\n)?/i, '')
    .replace(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g, '$1:$2:$3,$4')
    .trim();
};

const parseSRT = (srtString) => {
  if (!srtString) return [];
  const blocks = srtString.split(/\r?\n\s*\r?\n/);
  const result = [];

  for (const block of blocks) {
    const lines = block
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    let match = null;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(
        /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
      );
      if (m) {
        timeLineIdx = i;
        match = m;
        break;
      }
    }

    if (match && timeLineIdx !== -1) {
      const id = timeLineIdx > 0 ? lines[0] : (result.length + 1).toString();
      const startMs =
        parseInt(match[1]) * 3600000 +
        parseInt(match[2]) * 60000 +
        parseInt(match[3]) * 1000 +
        parseInt(match[4]);
      const endMs =
        parseInt(match[5]) * 3600000 +
        parseInt(match[6]) * 60000 +
        parseInt(match[7]) * 1000 +
        parseInt(match[8]);

      const text = lines
        .slice(timeLineIdx + 1)
        .join(' ')
        .trim();

      const cleanText = text.replace(/[([{].*?[)\]}]/g, '').trim();

      if (cleanText) {
        result.push({
          id,
          startMs,
          endMs,
          durationMs: endMs - startMs,
          text: cleanText,
        });
      }
    }
  }
  return result;
};

export const useVideoRemaker = (settings) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, downloading, translating, remaking, done
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [options, setOptions] = useState({
    flip: false,
    speed: 1.05,
    colorShift: true,
    vignette: true,
    audioPitch: false,
    audioDelay: false,
    transcribe: true,
    reviewSrt: false,
    remakeLevel: 'strong',
    bgmMode: 'demucs',
    publishYoutube: false,
    publishFacebook: false,
    publishTiktok: false,
    blurBorder: false,
    usePremiumAI: true,
  });
  const [showSrtModal, setShowSrtModal] = useState(false);
  const [srtText, setSrtText] = useState('');
  const [envStatus, setEnvStatus] = useState({ ffmpeg: true, ytdlp: true, demucs: true });
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('video_remake_history') || '[]');
    } catch {
      return [];
    }
  });

  const [videoSource, setVideoSource] = useState('url'); // 'url' or 'file'
  const [localFilePath, setLocalFilePath] = useState('');

  const getBasename = (filePath) => {
    if (!filePath) return '';
    return filePath.split(/[\\/]/).pop();
  };

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  useEffect(() => {
    const checkEnv = async () => {
      try {
        const res = await VideoRemakerService.checkEnv(settings);
        setEnvStatus(res);
        if (!settings?.useCloudEngine && (!res.ffmpeg || !res.ytdlp || !res.demucs)) {
          addLog(
            `Cảnh báo: ${!res.ffmpeg ? 'Thiếu FFmpeg. ' : ''}${!res.ytdlp ? 'Thiếu yt-dlp. ' : ''}${!res.demucs ? 'Thiếu Demucs (AI tách nhạc).' : ''}`,
            'error'
          );
        }
      } catch (err) {
        console.error('Check env error:', err);
      }
    };
    checkEnv();
  }, [settings]);

  const handleSelectFile = async () => {
    if (!window.electron || window.electron.isWebMock) {
      message.error('Ứng dụng cần chạy trong Electron để duyệt file hệ thống.');
      return;
    }
    try {
      const res = await window.electron.selectFile('video');
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return;
      }
      const filePath = res.filePaths[0];
      setLocalFilePath(filePath);
      addLog(`Đã chọn video cục bộ: ${filePath}`, 'success');
      message.success('Chọn video thành công!');
    } catch (error) {
      message.error('Không thể chọn video: ' + error.message);
    }
  };

  const handleStart = async () => {
    if (videoSource === 'url' && !url) {
      return message.warning('Vui lòng nhập link video (Douyin, Youtube, Facebook...)');
    }
    if (videoSource === 'file' && !localFilePath) {
      return message.warning('Vui lòng chọn video từ máy tính.');
    }

    const isWeb = !window.electron || window.electron.isWebMock;
    const effectiveOpenAIKey = options.usePremiumAI
      ? (settings?.openaiKey || (isWeb ? 'SERVER_KEY' : ''))
      : (settings?.groqKey || (isWeb ? 'SERVER_KEY' : ''));
    const effectiveGeminiKey = settings?.geminiKey || (isWeb ? 'SERVER_KEY' : '');

    setLoading(true);
    setLogs([]);
    setProgress(0);

    try {
      let inputPath = '';
      let originalTitle = '';
      let originalDesc = '';
      let downloadRes = null;

      if (videoSource === 'file') {
        setStatus('remaking');
        inputPath = localFilePath;
        originalTitle = getBasename(localFilePath);
        originalDesc = 'Tệp video cục bộ';
        setProgress(40);
        addLog(`Sử dụng video cục bộ: ${inputPath}`, 'success');
      } else {
        setStatus('downloading');
        addLog(`Bắt đầu xử lý: ${url}`);
        // Step 1: Download
        addLog('Đang tải video qua yt-dlp...', 'process');
        downloadRes = await VideoRemakerService.videoDownload(url, settings);

        if (!downloadRes.ok) {
          throw new Error(downloadRes.error);
        }

        inputPath = downloadRes.path;
        originalTitle = downloadRes.videoTitle || '';
        originalDesc = downloadRes.videoDescription || '';
        setProgress(40);
        addLog(`Đã tải video: ${inputPath}`, 'success');
      }

      // Step 2: Transcribe & Extract original audio
      let srtContent = '';
      let originalAudioPath = '';
      const hasSubtitles =
        videoSource === 'file' || !downloadRes ? false : !!downloadRes.subContent;
      let finalSegments = [];

      if (options.transcribe) {
        setStatus('translating');
        addLog('Đang tiến hành trích xuất & chuyển giọng nói thành văn bản...', 'process');

        // Extract original audio to .mp3
        addLog('Đang trích xuất tệp âm thanh gốc...', 'process');
        const extractRes = await VideoRemakerService.extractAudio(inputPath, settings);
        if (extractRes.ok) {
          originalAudioPath = extractRes.path;
          addLog('Đã trích xuất tệp âm thanh gốc.', 'success');

          // Step 2.5: Xử lý nhạc nền
          if (options.bgmMode && options.bgmMode !== 'none') {
            addLog(
              `Đang xử lý nhạc nền (Chế độ: ${options.bgmMode === 'demucs' ? 'Tách nhạc nền AI Demucs' : 'Giảm âm lượng duck -12dB'})...`,
              'process'
            );
            const bgmRes = await VideoRemakerService.separateBgm(
              originalAudioPath,
              options.bgmMode,
              settings
            );
            if (bgmRes.ok) {
              if (bgmRes.warning) {
                addLog(`Cảnh báo nhạc nền: ${bgmRes.warning}`, 'warning');
              } else {
                addLog(`Đã xử lý nhạc nền thành công (${bgmRes.mode}).`, 'success');
              }
            } else {
              addLog(`Lỗi xử lý nhạc nền: ${bgmRes.error}`, 'warning');
            }
          }
        } else {
          addLog('Không thể trích xuất tệp âm thanh gốc.', 'warning');
        }

        if (hasSubtitles) {
          addLog('Phát hiện phụ đề gốc từ video! Đang chuyển đổi...', 'success');
          srtContent = convertVttToSrt(downloadRes.subContent);
        } else if (originalAudioPath) {
          try {
            if (effectiveOpenAIKey) {
              const isGroq = !options.usePremiumAI || effectiveOpenAIKey.startsWith('gsk_');
              const providerName = isGroq
                ? 'Groq'
                : effectiveOpenAIKey === 'SERVER_KEY'
                  ? 'Server OpenAI'
                  : 'OpenAI';

              addLog(
                `Đang nhận diện giọng nói bằng AI Whisper của ${providerName} (SRT)...`,
                'process'
              );
              const sttRes = await VideoRemakerService.transcribeAudio(
                originalAudioPath,
                effectiveOpenAIKey,
                settings,
                options.usePremiumAI ? 'openai' : 'groq'
              );

              if (sttRes.ok) {
                srtContent = sttRes.text;
                addLog('Nhận diện phụ đề thành công!', 'success');
              } else {
                throw new Error(sttRes.error);
              }
            } else if (effectiveGeminiKey) {
              addLog('Đang sử dụng Google Gemini để trích xuất phụ đề (Free)...', 'process');

              addLog('Đang tối ưu dung lượng tệp âm thanh cho AI (Nén sang MP3)...', 'process');
              const compressRes = await VideoRemakerService.compressAudio(
                originalAudioPath,
                settings
              );
              let audioToRead = originalAudioPath;
              let mimeType = 'audio/wav';

              if (compressRes.ok) {
                audioToRead = compressRes.path;
                mimeType = 'audio/mp3';
                addLog('Tối ưu hóa tệp âm thanh thành công.', 'success');
              } else {
                addLog(
                  `Không thể nén âm thanh: ${compressRes.error}. Gửi tệp WAV gốc...`,
                  'warning'
                );
              }

              const base64Res = await VideoRemakerService.readFileBase64(audioToRead, settings);
              if (!base64Res.ok) {
                throw new Error(`Không thể đọc tệp âm thanh: ${base64Res.error}`);
              }

              const base64Audio = base64Res.data;
              const prompt = `Bạn là một chuyên gia phụ đề chuyên nghiệp. Hãy nghe cực kỳ kỹ lưỡng tệp âm thanh đính kèm này và tạo phụ đề theo định dạng SRT chuẩn 100% bằng ngôn ngữ gốc của âm thanh.
CHỈ trả về duy nhất chuỗi nội dung SRT thuần túy. Tuyệt đối không giải thích gì thêm, không bọc trong thẻ code markdown \`\`\`srt hay bất kỳ ký tự nào khác ngoài định dạng SRT.`;

              const modelsToTry = [
                { name: 'gemini-2.5-flash', version: 'v1beta' },
                { name: 'gemini-2.0-flash', version: 'v1beta' },
                { name: 'gemini-3.5-flash', version: 'v1beta' },
              ];
              let response = null;
              let successModel = '';
              let lastErrorMsg = '';

              for (const modelCfg of modelsToTry) {
                const modelName = modelCfg.name;
                const apiVer = modelCfg.version;
                try {
                  const geminiUrl =
                    effectiveGeminiKey === 'SERVER_KEY'
                      ? `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=SERVER_KEY`
                      : `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=${effectiveGeminiKey}`;

                  addLog(
                    `Thử trích xuất phụ đề bằng model: ${modelName} (${apiVer})...`,
                    'process'
                  );
                  const res = await VideoRemakerService.ttsRequest(
                    geminiUrl,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: {
                        contents: [
                          {
                            parts: [
                              {
                                inlineData: {
                                  mimeType: mimeType,
                                  data: base64Audio,
                                },
                              },
                              {
                                text: prompt,
                              },
                            ],
                          },
                        ],
                      },
                    },
                    settings
                  );

                  if (res.ok) {
                    const textResult = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textResult) {
                      response = res;
                      successModel = modelName;
                      break;
                    } else {
                      lastErrorMsg = `Model ${modelName} trả về phản hồi rỗng.`;
                    }
                  } else {
                    const errorDetail =
                      typeof res.error === 'object' ? JSON.stringify(res.error) : res.error;
                    lastErrorMsg = `Model ${modelName} lỗi API: ${errorDetail}`;
                  }
                } catch (e) {
                  lastErrorMsg = `Model ${modelName} lỗi kết nối: ${e.message}`;
                  console.warn(`Thử model ${modelName} thất bại:`, e.message);
                }
              }

              if (!response) {
                throw new Error(
                  `Không thể trích xuất phụ đề bằng bất kỳ model Gemini nào. Chi tiết lỗi cuối: ${lastErrorMsg}`
                );
              }

              const textResult = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
              srtContent = textResult
                .replace(/```srt/gi, '')
                .replace(/```/g, '')
                .trim();

              addLog(`Đã trích xuất phụ đề thành công bằng ${successModel}!`, 'success');
            } else {
              throw new Error(
                'Tính năng nhận diện giọng nói bắt buộc phải có OpenAI/Groq Key hoặc Gemini API Key trong phần Cài đặt.'
              );
            }
          } catch (err) {
            addLog(`Lỗi trích xuất/nhận diện: ${err.message}`, 'error');
            throw err;
          }
        }

        if (srtContent) {
          let segments = parseSRT(srtContent);
          addLog(
            `Phân tích được ${segments.length} phân đoạn hội thoại. Đang tiến hành dịch thuật tiếng Việt...`,
            'process'
          );

          const translateRes = await VideoRemakerService.translateSegments(
            segments,
            effectiveGeminiKey,
            effectiveOpenAIKey,
            settings
          );

          if (translateRes.ok) {
            segments = translateRes.segments;
            addLog(`Dịch phụ đề thành công bằng ${translateRes.provider}!`, 'success');
          } else {
            addLog(
              `Lỗi dịch thuật: ${translateRes.error}. Tiếp tục sử dụng phụ đề gốc.`,
              'warning'
            );
            segments = segments.map((s) => ({ ...s, text_vi: s.text }));
          }

          if (options.reviewSrt && segments.length > 0) {
            const formatTime = (ms) => {
              const pad = (num, size) => ('000' + num).slice(-size);
              const hrs = Math.floor(ms / 3600000);
              const mins = Math.floor((ms % 3600000) / 60000);
              const secs = Math.floor((ms % 60000) / 1000);
              const msec = Math.floor(ms % 1000);
              return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(msec, 3)}`;
            };
            const viSrtText = segments
              .map(
                (s, idx) =>
                  `${idx + 1}\n${formatTime(s.startMs)} --> ${formatTime(s.endMs)}\n${s.text_vi || s.text}`
              )
              .join('\n\n');

            addLog('Đang chờ người dùng kiểm tra và chỉnh sửa phụ đề tiếng Việt...', 'process');
            setSrtText(viSrtText);
            setShowSrtModal(true);
            setLoading(false);
            const editedSrt = await new Promise((resolve, reject) => {
              window.resolveSrtPromise = resolve;
              window.rejectSrtPromise = reject;
            });
            setLoading(true);
            if (!editedSrt) {
              throw new Error('Đã hủy tiến trình bởi người dùng.');
            }

            const editedSegments = parseSRT(editedSrt);
            segments = segments.map((s, idx) => {
              const ed = editedSegments.find((e) => e.id === s.id || e.startMs === s.startMs);
              return {
                ...s,
                text_vi: ed ? ed.text : editedSegments[idx] ? editedSegments[idx].text : s.text_vi,
              };
            });
            addLog('Đã xác nhận phụ đề tiếng Việt! Tiếp tục tiến trình remake...', 'success');
          }

          const formatTime = (ms) => {
            const pad = (num, size) => ('000' + num).slice(-size);
            const hrs = Math.floor(ms / 3600000);
            const mins = Math.floor((ms % 3600000) / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            const msec = Math.floor(ms % 1000);
            return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(msec, 3)}`;
          };
          srtContent = segments
            .map(
              (s, idx) =>
                `${idx + 1}\n${formatTime(s.startMs)} --> ${formatTime(s.endMs)}\n${s.text_vi || s.text}`
            )
            .join('\n\n');

          finalSegments = segments;
        }
      }

      // Sinh âm thanh thuyết minh từng segment
      if (finalSegments && finalSegments.length > 0) {
        addLog(
          `Đang sinh giọng đọc AI tiếng Việt cho ${finalSegments.length} phân đoạn...`,
          'process'
        );

        for (let i = 0; i < finalSegments.length; i++) {
          const seg = finalSegments[i];
          const percent = 45 + Math.round((i / finalSegments.length) * 35); // 45% -> 80%
          setProgress(percent);
          addLog(`[TTS - ${i + 1}/${finalSegments.length}] Đang đọc: "${seg.text_vi}"`, 'process');

          try {
            let audioBlob = null;
            if (options.usePremiumAI) {
              // Dùng Edge TTS làm mặc định nếu không cấu hình FPT/OpenAI
              if (settings?.fptKey) {
                audioBlob = await TTSProvider.speakWithFPT(seg.text_vi, 'banmai', settings.fptKey);
              } else if (settings?.openaiKey && !settings.openaiKey.startsWith('gsk_')) {
                audioBlob = await TTSProvider.speakWithOpenAI(
                  seg.text_vi,
                  'alloy',
                  settings.openaiKey
                );
              } else {
                audioBlob = await TTSProvider.speakWithEdge(seg.text_vi, 'vi-VN-HoaiMyNeural');
              }
            } else {
              // Free Mode forces Edge TTS
              audioBlob = await TTSProvider.speakWithEdge(seg.text_vi, 'vi-VN-HoaiMyNeural');
            }

            if (audioBlob) {
              const tempPath = await VideoRemakerService.saveTempAudio(audioBlob, settings);
              seg.audioPath = tempPath;
            } else {
              throw new Error('TTS không phản hồi dữ liệu âm thanh.');
            }
          } catch (ttsErr) {
            addLog(`Lỗi TTS phân đoạn ${seg.id}: ${ttsErr.message}. Bỏ qua.`, 'warning');
          }
        }
        addLog('Đã sinh giọng đọc thuyết minh hoàn tất cho tất cả phân đoạn!', 'success');
      }

      // Step 3: Remake
      setStatus('remaking');
      addLog('Đang tiến hành lách bản quyền & kết xuất video...', 'process');

      const remakeOptions = {
        ...options,
        srtContent: srtContent,
        originalAudioPath: originalAudioPath,
        segments: finalSegments,
      };

      const remakeRes = await VideoRemakerService.videoRemake(inputPath, remakeOptions, settings);

      if (!remakeRes.ok) {
        throw new Error(remakeRes.error);
      }

      // Step 5: Sinh Metadata & Thumbnail Prompt tự động
      try {
        addLog(
          'Đang tự động sinh Tiêu đề, Mô tả SEO và câu lệnh vẽ ảnh thu nhỏ (Thumbnail prompt)...',
          'process'
        );

        const convText = (finalSegments || []).map((s) => s.text_vi || s.text).join('\n');
        const metaPrompt = `Bạn là một chuyên gia Marketing và SEO video chuyên nghiệp. Dựa vào thông tin chi tiết của video dưới đây, hãy tạo các thông tin SEO chất lượng cao (Tiêu đề, Mô tả và Hashtags bằng TIẾNG VIỆT):
1. Một Tiêu đề (Title) hấp dẫn, giật gân, chuẩn tìm kiếm.
2. Một đoạn Mô tả (Description) tóm tắt nội dung video, kèm danh sách 3-5 thẻ hashtags phù hợp nhất.
3. Một câu lệnh prompt (bằng tiếng Anh) để tạo ảnh thu nhỏ (thumbnail prompt) cho video này thông qua AI (như Midjourney hoặc DALL-E).

Thông tin video gốc:
- Tiêu đề gốc: ${originalTitle || 'N/A'}
- Mô tả gốc: ${originalDesc || 'N/A'}

Nội dung thuyết minh dịch tiếng Việt (nếu có):
${convText || 'N/A'}

Hãy trả về duy nhất chuỗi JSON có cấu trúc như sau, không bọc trong markdown hay giải thích thêm:
{
  "title": "...",
  "description": "...",
  "hashtags": ["#tag1", "#tag2"],
  "thumbnailPrompt": "..."
}`;

        let metadataObj = null;

        if (effectiveGeminiKey) {
          const modelsToTry = [
            { name: 'gemini-2.5-flash', version: 'v1beta' },
            { name: 'gemini-2.0-flash', version: 'v1beta' },
            { name: 'gemini-3.5-flash', version: 'v1beta' },
          ];
          for (const modelCfg of modelsToTry) {
            const modelName = modelCfg.name;
            const apiVer = modelCfg.version;
            try {
              const geminiUrl =
                effectiveGeminiKey === 'SERVER_KEY'
                  ? `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=SERVER_KEY`
                  : `https://generativelanguage.googleapis.com/${apiVer}/models/${modelName}:generateContent?key=${effectiveGeminiKey}`;

              addLog(`Thử sinh Metadata bằng model: ${modelName} (${apiVer})...`, 'process');
              const res = await VideoRemakerService.ttsRequest(
                geminiUrl,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: {
                    contents: [{ parts: [{ text: metaPrompt }] }],
                  },
                },
                settings
              );

              if (res.ok) {
                let resText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (resText) {
                  resText = resText
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .trim();
                  metadataObj = JSON.parse(resText);
                  addLog(`Sinh Metadata thành công bằng ${modelName}!`, 'success');
                  break;
                }
              }
            } catch (e) {
              console.warn(`Thử model ${modelName} sinh metadata thất bại:`, e.message);
            }
          }
        }

        if (!metadataObj && effectiveOpenAIKey) {
          const isGroq = effectiveOpenAIKey.startsWith('gsk_');
          const apiUrl = isGroq
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';

          const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${effectiveOpenAIKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: metaPrompt }],
              temperature: 0.3,
            }),
          });

          if (response.ok) {
            const resJson = await response.json();
            let resText = resJson.choices?.[0]?.message?.content;
            if (resText) {
              resText = resText
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();
              metadataObj = JSON.parse(resText);
            }
          }
        }

        if (metadataObj) {
          addLog(
            `Đã sinh thông tin SEO thành công! Tiêu đề gợi ý: "${metadataObj.title}"`,
            'success'
          );
          const saveRes = await VideoRemakerService.saveMetadata(
            remakeRes.path,
            metadataObj,
            metadataObj.thumbnailPrompt,
            settings
          );
          if (saveRes.ok) {
            addLog(
              `Đã lưu tệp youtube_metadata.json và thumbnail_prompts.txt trong thư mục video.`,
              'success'
            );
          }
        } else {
          addLog('Không thể sinh tự động Metadata SEO. Sử dụng thông tin mặc định.', 'warning');
        }

        // Tự động đăng tải lên các kênh đã tick chọn
        const publishPlatforms = [];
        if (options.publishYoutube) publishPlatforms.push('youtube');
        if (options.publishFacebook) publishPlatforms.push('facebook');
        if (options.publishTiktok) publishPlatforms.push('tiktok');

        if (publishPlatforms.length > 0) {
          addLog(
            `Đang thực hiện tự động đăng tải lên: ${publishPlatforms.join(', ').toUpperCase()}...`,
            'process'
          );
          const publishRes = await VideoRemakerService.publishVideo(
            remakeRes.path,
            metadataObj || { title: 'Video Remake', description: '' },
            publishPlatforms,
            settings
          );
          if (publishRes.ok && publishRes.urls) {
            const urls = publishRes.urls;
            if (urls.youtube)
              addLog(`[YouTube] Đã đăng tải thành công! Xem tại: ${urls.youtube}`, 'success');
            if (urls.facebook)
              addLog(`[Facebook] Đã đăng tải thành công! Xem tại: ${urls.facebook}`, 'success');
            if (urls.tiktok)
              addLog(`[TikTok] Đã đăng tải thành công! Xem tại: ${urls.tiktok}`, 'success');
          } else {
            addLog(`Lỗi khi đăng tải: ${publishRes.error || 'Lỗi không xác định.'}`, 'error');
          }
        }
      } catch (metaErr) {
        addLog(`Lỗi tự động sinh Metadata hoặc đăng tải: ${metaErr.message}`, 'warning');
      }

      setProgress(100);
      setStatus('done');
      addLog(`Hoàn tất! Video lưu tại: ${remakeRes.path}`, 'success');
      message.success('Đã remake & lồng tiếng video thành công!');

      // Lưu lịch sử remake
      const historyItem = {
        id: Date.now(),
        url: url,
        outputPath: remakeRes.path,
        targetLang: options.transcribe ? 'txt' : '',
        time: new Date().toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        }),
      };
      setHistory((prev) => {
        const updated = [historyItem, ...prev];
        localStorage.setItem('video_remake_history', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setStatus('idle');
      addLog(`Lỗi: ${err.message}`, 'error');
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    url,
    setUrl,
    loading,
    status,
    setStatus,
    progress,
    setProgress,
    logs,
    options,
    setOptions,
    showSrtModal,
    setShowSrtModal,
    srtText,
    setSrtText,
    envStatus,
    history,
    setHistory,
    handleStart,
    addLog,
    getBasename,
    videoSource,
    setVideoSource,
    localFilePath,
    setLocalFilePath,
    handleSelectFile,
  };
};

export default useVideoRemaker;
