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
  const blocks = srtString.split(/\n\s*\n/);
  const result = [];

  for (const block of blocks) {
    const lines = block
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let match = null;

    // Quét qua các dòng để tìm dòng chứa mốc thời gian
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
      const startMs =
        parseInt(match[1]) * 3600000 +
        parseInt(match[2]) * 60000 +
        parseInt(match[3]) * 1000 +
        parseInt(match[4]);

      // Lấy tất cả các dòng sau dòng thời gian làm nội dung phụ đề
      const text = lines
        .slice(timeLineIdx + 1)
        .join(' ')
        .trim();

      // Loại bỏ các âm thanh phụ trong ngoặc, ví dụ: (bright music), [Sparky barks]
      const cleanText = text.replace(/[([{].*?[)\]}]/g, '').trim();

      if (cleanText) {
        result.push({ text: cleanText, startMs });
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
  });
  const [showSrtModal, setShowSrtModal] = useState(false);
  const [srtText, setSrtText] = useState('');
  const [envStatus, setEnvStatus] = useState({ ffmpeg: true, ytdlp: true });
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('video_remake_history') || '[]');
    } catch {
      return [];
    }
  });

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
        const res = await VideoRemakerService.checkEnv();
        setEnvStatus(res);
        if (!res.ffmpeg || !res.ytdlp) {
          addLog(
            `Cảnh báo: ${!res.ffmpeg ? 'Thiếu FFmpeg. ' : ''}${!res.ytdlp ? 'Thiếu yt-dlp.' : ''}`,
            'error'
          );
        }
      } catch (err) {
        console.error('Check env error:', err);
      }
    };
    checkEnv();
  }, []);

  const handleStart = async () => {
    if (!url) return message.warning('Vui lòng nhập link video (Douyin, Youtube, Facebook...)');

    setLoading(true);
    setLogs([]);
    setProgress(0);
    setStatus('downloading');
    addLog(`Bắt đầu xử lý: ${url}`);

    try {
      // Step 1: Download
      addLog('Đang tải video qua yt-dlp...', 'process');
      const downloadRes = await VideoRemakerService.videoDownload(url);

      if (!downloadRes.ok) {
        throw new Error(downloadRes.error);
      }

      const inputPath = downloadRes.path;
      setProgress(40);
      addLog(`Đã tải video: ${inputPath}`, 'success');

      // Step 2: Transcribe & Extract original audio
      let srtContent = '';
      let originalAudioPath = '';
      const hasSubtitles = !!downloadRes.subContent;

      if (options.transcribe) {
        setStatus('translating');
        addLog('Đang tiến hành trích xuất & chuyển giọng nói thành văn bản...', 'process');

        // Extract original audio to .mp3
        addLog('Đang trích xuất tệp âm thanh gốc...', 'process');
        const extractRes = await VideoRemakerService.extractAudio(inputPath);
        if (extractRes.ok) {
          originalAudioPath = extractRes.path;
          addLog('Đã trích xuất tệp âm thanh gốc.', 'success');
        } else {
          addLog('Không thể trích xuất tệp âm thanh gốc.', 'warning');
        }

        if (hasSubtitles) {
          addLog('Phát hiện phụ đề gốc từ video! Đang chuyển đổi...', 'success');
          srtContent = convertVttToSrt(downloadRes.subContent);
        } else if (originalAudioPath) {
          const isWeb = !window.electron || window.electron.isWebMock;
          const effectiveOpenAIKey = settings?.openaiKey || (isWeb ? 'SERVER_KEY' : '');
          const effectiveGeminiKey = settings?.geminiKey || (isWeb ? 'SERVER_KEY' : '');

          try {
            if (effectiveOpenAIKey) {
              const isGroq = effectiveOpenAIKey.startsWith('gsk_');
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
                effectiveOpenAIKey
              );

              if (sttRes.ok) {
                srtContent = sttRes.text;
                addLog('Nhận diện phụ đề thành công!', 'success');
              } else {
                throw new Error(sttRes.error);
              }
            } else if (effectiveGeminiKey) {
              addLog(
                'Đang sử dụng Google Gemini 1.5 Flash để trích xuất phụ đề (Free)...',
                'process'
              );

              const base64Res = await VideoRemakerService.readFileBase64(originalAudioPath);
              if (!base64Res.ok) {
                throw new Error(`Không thể đọc tệp âm thanh: ${base64Res.error}`);
              }

              const base64Audio = base64Res.data;
              const prompt = `Bạn là một chuyên gia phụ đề chuyên nghiệp. Hãy nghe cực kỳ kỹ lưỡng tệp âm thanh đính kèm này và tạo phụ đề theo định dạng SRT chuẩn 100% bằng ngôn ngữ gốc của âm thanh.
CHỈ trả về duy nhất chuỗi nội dung SRT thuần túy. Tuyệt đối không giải thích gì thêm, không bọc trong thẻ code markdown \`\`\`srt hay bất kỳ ký tự nào khác ngoài định dạng SRT.`;

              const geminiUrl =
                effectiveGeminiKey === 'SERVER_KEY'
                  ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SERVER_KEY'
                  : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveGeminiKey}`;

              const response = await VideoRemakerService.ttsRequest(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                  contents: [
                    {
                      parts: [
                        {
                          inlineData: {
                            mimeType: 'audio/mp3',
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
              });

              if (!response.ok) {
                const errMsg =
                  typeof response.error === 'object'
                    ? JSON.stringify(response.error)
                    : response.error || 'Lỗi API Gemini';
                throw new Error(errMsg);
              }

              const textResult = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!textResult) {
                throw new Error('Gemini không phản hồi văn bản phụ đề.');
              }

              srtContent = textResult
                .replace(/```srt/gi, '')
                .replace(/```/g, '')
                .trim();

              addLog('Đã trích xuất phụ đề thành công bằng Gemini 1.5 Flash!', 'success');
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

        if (options.reviewSrt && srtContent) {
          addLog('Đang chờ người dùng kiểm tra và chỉnh sửa phụ đề...', 'process');
          setSrtText(srtContent);
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
          srtContent = editedSrt;
          addLog('Đã xác nhận phụ đề! Tiếp tục tiến trình remake...', 'success');
        }
      }

      // Step 3: Remake
      setStatus('remaking');
      addLog('Đang tiến hành lách bản quyền & kết xuất video...', 'process');

      const remakeOptions = {
        ...options,
        srtContent: srtContent,
        originalAudioPath: originalAudioPath,
      };

      const remakeRes = await VideoRemakerService.videoRemake(inputPath, remakeOptions);

      if (!remakeRes.ok) {
        throw new Error(remakeRes.error);
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
  };
};

export default useVideoRemaker;
