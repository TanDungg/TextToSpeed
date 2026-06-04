import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  message,
  Row,
  Col,
  Checkbox,
  Select,
  Progress,
  Tag,
  Divider,
  Modal,
} from 'antd';
import {
  DownloadCloud,
  Languages,
  Settings2,
  Zap,
  Info,
  ExternalLink,
  History,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import './VideoRemakerStyles.scss';

import TTSProvider from '../../_service/TTSProvider';

const { Title, Text } = Typography;

// Polyfill window.electron on web browser/Hugging Face for seamless feature integration
if (typeof window !== 'undefined' && !window.electron) {
  window.electron = {
    checkEnv: async () => {
      try {
        const res = await fetch('/api/check-env');
        return await res.json();
      } catch {
        return { ffmpeg: false, ytdlp: false };
      }
    },
    videoDownload: async (url) => {
      const response = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Tải video từ Cloud thất bại.' };
      }
      return await response.json();
    },
    videoRemake: async (videoPath, options) => {
      const response = await fetch('/api/video-remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath, options: JSON.stringify(options) }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Lách video thất bại trên Cloud.' };
      }
      return await response.json();
    },
    extractAudio: async (videoPath) => {
      const response = await fetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Trích xuất âm thanh từ Cloud thất bại.' };
      }
      return await response.json();
    },
    transcribeAudio: async (audioPath, apiKey) => {
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, apiKey }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Nhận diện giọng nói từ Cloud thất bại.' };
      }
      return await response.json();
    },
    readFileBase64: async (filePath) => {
      const response = await fetch('/api/read-file-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Đọc file từ Cloud thất bại.' };
      }
      return await response.json();
    },
    ttsRequest: async (url, options = {}) => {
      const response = await fetch('/api/tts-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Yêu cầu Proxy thất bại.' };
      }
      const result = await response.json();
      if (result.ok && result.isBinary && typeof result.data === 'string') {
        const binaryString = window.atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        result.data = bytes.buffer;
      }
      return result;
    },
    showItemInFolder: (filePath) => {
      console.log('Mở thư mục chứa file:', filePath);
      message.info(`File được lưu tại: ${filePath}`);
    },
    isWebMock: true,
    saveTempAudio: async (buffer) => {
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const formData = new FormData();
      formData.append('file', blob, `voice-${Date.now()}.mp3`);
      const response = await fetch('/api/save-temp-audio', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Không thể lưu file âm thanh tạm thời trên Cloud.');
      }
      const uploadData = await response.json();
      return uploadData.path;
    },
  };
}

const convertVttToSrt = (vttText) => {
  if (!vttText) return '';
  return vttText
    .replace(/^WEBVTT\r?\n(Kind:.*\r?\n)?(Language:.*\r?\n)?/i, '')
    .replace(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g, '$1:$2:$3,$4')
    .trim();
};

const VideoRemaker = ({ settings }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, downloading, translating, remaking, done
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [options, setOptions] = useState({
    flip: true,
    speed: 1.05,
    colorShift: true,
    vignette: true,
    audioPitch: true,
    audioDelay: true,
    translate: true,
    targetLang: 'vi',
    ttsServer: 'edge',
    ttsVoice: 'vi-VN-HoaiMyNeural',
    ttsSpeed: 1.0, // Tốc độ giọng đọc riêng biệt
    reviewSrt: false, // Tùy chọn xem và sửa phụ đề trước khi lồng tiếng
    remakeLevel: 'strong', // Cường độ lách bản quyền: normal (nhẹ) hoặc strong (mạnh - YT)
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

  useEffect(() => {
    const checkEnv = async () => {
      try {
        const res = await window.electron.checkEnv();
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

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

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
      let downloadRes;
      if (window.electron) {
        downloadRes = await window.electron.videoDownload(url);
      } else {
        const response = await fetch('/api/video-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Tải video từ Cloud thất bại.');
        }
        downloadRes = await response.json();
      }

      if (!downloadRes.ok) {
        throw new Error(downloadRes.error);
      }

      const inputPath = downloadRes.path;
      setProgress(40);
      addLog(`Đã tải video: ${inputPath}`, 'success');

      // Step 2: Translate (Real AI Voice Extraction & Dubbing - Two-Pass timing alignment)
      let remakedNoVoicePath = '';
      let externalAudioList = [];
      let remakeOptions = { ...options };
      const hasSubtitles = !!downloadRes.subContent;

      if (options.translate) {
        setStatus('remaking');
        addLog('Pass 1: Đang lách bản quyền & đổi tốc độ video gốc...', 'process');

        const isWeb = !window.electron || window.electron.isWebMock;
        const effectiveOpenAIKey = settings?.openaiKey || (isWeb ? 'SERVER_KEY' : '');
        const effectiveGeminiKey = settings?.geminiKey || (isWeb ? 'SERVER_KEY' : '');
        const effectiveGoogleKey = settings?.googleKey || (isWeb ? 'SERVER_KEY' : '');
        const effectiveFptKey = settings?.fptKey || (isWeb ? 'SERVER_KEY' : '');
        const effectiveElevenLabsKey = settings?.elevenLabsKey || (isWeb ? 'SERVER_KEY' : '');

        const firstRemakeOptions = {
          ...options,
          translate: false, // Chỉ xử lý hình ảnh và tốc độ video ở Pass 1
        };

        let firstRemakeRes;
        if (window.electron) {
          firstRemakeRes = await window.electron.videoRemake(inputPath, firstRemakeOptions);
        } else {
          const response = await fetch('/api/video-remake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoPath: inputPath,
              options: JSON.stringify(firstRemakeOptions),
            }),
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Lách video thất bại trên Cloud.');
          }
          firstRemakeRes = await response.json();
        }

        if (!firstRemakeRes.ok) {
          throw new Error(firstRemakeRes.error);
        }
        remakedNoVoicePath = firstRemakeRes.path;
        addLog(
          `Đã hoàn tất Pass 1. Video lách bản quyền: ${getBasename(remakedNoVoicePath)}`,
          'success'
        );

        setStatus('translating');
        let translatedText = '';

        if (hasSubtitles) {
          addLog('Phát hiện phụ đề gốc từ YouTube! Đang chuyển đổi và dịch thuật...', 'success');
          const originalSrt = convertVttToSrt(downloadRes.subContent);

          try {
            if (effectiveOpenAIKey) {
              const isGroq = effectiveOpenAIKey.startsWith('gsk_');
              const providerName = isGroq ? 'Groq' : (effectiveOpenAIKey === 'SERVER_KEY' ? 'Server OpenAI' : 'OpenAI');
              addLog(`Đang dịch phụ đề bằng AI của ${providerName}...`, 'process');

              const prompt = `Translate the following SRT subtitles to ${options.targetLang}. Keep the exact same SRT format, timestamps, and structure. Do NOT add any extra text outside the SRT block:\n\n${originalSrt}`;

              let translateUrl = 'https://api.openai.com/v1/chat/completions';
              let translateModel = 'gpt-4o-mini';
              if (isGroq) {
                translateUrl = 'https://api.groq.com/openai/v1/chat/completions';
                translateModel = 'llama-3.3-70b-versatile';
              }

              const transRes = await window.electron.ttsRequest(translateUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${effectiveOpenAIKey}`,
                },
                body: {
                  model: translateModel,
                  messages: [{ role: 'user', content: prompt }],
                },
              });

              if (transRes.ok && transRes.data?.choices?.[0]?.message?.content) {
                translatedText = transRes.data.choices[0].message.content
                  .replace(/```srt/gi, '')
                  .replace(/```/g, '')
                  .trim();
              } else {
                translatedText = originalSrt;
              }
            } else if (effectiveGeminiKey) {
              addLog('Đang dịch phụ đề bằng Google Gemini 1.5 Flash (Free)...', 'process');

              const prompt = `Translate the following SRT subtitles to ${
                options.targetLang === 'vi'
                  ? 'Tiếng Việt'
                  : options.targetLang === 'en'
                    ? 'Tiếng Anh'
                    : 'Tiếng Trung'
              }. Keep the exact same SRT format, timestamps, and structure. Do NOT add any extra text, and do not wrap in markdown code blocks. Here is the SRT content:\n\n${originalSrt}`;

              const geminiUrl = effectiveGeminiKey === 'SERVER_KEY'
                ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SERVER_KEY'
                : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveGeminiKey}`;

              const response = await window.electron.ttsRequest(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                  contents: [{ parts: [{ text: prompt }] }],
                },
              });

              if (response.ok && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                translatedText = response.data.candidates[0].content.parts[0].text
                  .replace(/```srt/gi, '')
                  .replace(/```/g, '')
                  .trim();
              } else {
                translatedText = originalSrt;
              }
            } else {
              throw new Error(
                'Tính năng dịch phụ đề bắt buộc phải có OpenAI/Groq Key hoặc Gemini API Key trong phần Cài đặt.'
              );
            }
            addLog('Đã dịch thuật phụ đề thành công!', 'success');
          } catch (err) {
            addLog(`Lỗi dịch phụ đề: ${err.message}. Sử dụng phụ đề gốc.`, 'warning');
            translatedText = originalSrt;
          }
        } else {
          // Trích xuất âm thanh từ video gốc (chưa đổi tốc độ)
          addLog('Đang trích xuất âm thanh từ video gốc...', 'process');
          const extractRes = await window.electron.extractAudio(inputPath);
          if (!extractRes.ok) throw new Error('Không thể trích xuất âm thanh từ video gốc.');

          // 2 & 3. Chuyển âm thanh thành văn bản & Dịch thuật
          try {
            if (effectiveOpenAIKey) {
              const isGroq = effectiveOpenAIKey.startsWith('gsk_');
              const providerName = isGroq ? 'Groq' : (effectiveOpenAIKey === 'SERVER_KEY' ? 'Server OpenAI' : 'OpenAI');

              addLog(
                `Đang nhận diện giọng nói bằng AI Whisper của ${providerName} (SRT Format)...`,
                'process'
              );
              const sttRes = await window.electron.transcribeAudio(
                extractRes.path,
                effectiveOpenAIKey
              );

              if (sttRes.ok) {
                const transcribedText = sttRes.text;
                addLog(
                  `Đã nhận diện thành công SRT. Đang dịch thuật bằng ${providerName}...`,
                  'success'
                );

                const prompt = `Translate the following SRT subtitles to ${options.targetLang}. Keep the exact same SRT format, timestamps, and structure. Do NOT add any extra text outside the SRT block:\n\n${transcribedText}`;

                let translateUrl = 'https://api.openai.com/v1/chat/completions';
                let translateModel = 'gpt-4o-mini';

                if (isGroq) {
                  translateUrl = 'https://api.groq.com/openai/v1/chat/completions';
                  translateModel = 'llama-3.3-70b-versatile';
                }

                const transRes = await window.electron.ttsRequest(translateUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${effectiveOpenAIKey}`,
                  },
                  body: {
                    model: translateModel,
                    messages: [{ role: 'user', content: prompt }],
                  },
                });

                if (transRes.ok && transRes.data?.choices?.[0]?.message?.content) {
                  translatedText = transRes.data.choices[0].message.content
                    .replace(/```srt/gi, '')
                    .replace(/```/g, '')
                    .trim();
                } else {
                  addLog(
                    `Lỗi dịch bằng ${providerName}, sử dụng văn bản gốc nhận diện từ Whisper.`,
                    'warning'
                  );
                  translatedText = transcribedText;
                }
              } else {
                throw new Error(sttRes.error);
              }
            } else if (effectiveGeminiKey) {
              // Sử dụng Gemini 1.5 Flash để dịch & trích xuất phụ đề trực tiếp từ âm thanh (MIỄN PHÍ)
              addLog(
                'Đang sử dụng Google Gemini 1.5 Flash để trích xuất & dịch phụ đề trực tiếp từ âm thanh (Free)...',
                'process'
              );

              const base64Res = await window.electron.readFileBase64(extractRes.path);
              if (!base64Res.ok) {
                throw new Error(`Không thể đọc file âm thanh: ${base64Res.error}`);
              }

              const base64Audio = base64Res.data;
              const prompt = `Bạn là một chuyên gia phụ đề và lồng tiếng phim chuyên nghiệp. Hãy nghe cực kỳ kỹ lưỡng tệp âm thanh đính kèm này và tạo phụ đề dịch sang ${
                options.targetLang === 'vi'
                  ? 'Tiếng Việt'
                  : options.targetLang === 'en'
                    ? 'Tiếng Anh'
                    : 'Tiếng Trung'
              } theo định dạng SRT chuẩn 100%.

QUY TẮC BẮT BUỘC VỀ THỜI GIAN (RẤT QUAN TRỌNG):
1. KHÔNG ĐƯỢC tự động lấy mốc bắt đầu của câu đầu tiên là 00:00:00,000 trừ khi nhân vật nói ngay tại giây thứ 0. Nếu đoạn đầu video chỉ có nhạc nền, tiếng động hoặc im lặng, mốc bắt đầu của phụ đề phải là THỜI ĐIỂM CHÍNH XÁC nhân vật mở miệng nói từ đầu tiên (ví dụ: nhân vật im lặng 12 giây rồi mới nói, thì mốc phải là 00:00:12,000 --> 00:00:16,320).
2. KHÔNG ĐƯỢC viết các khối thời gian nối tiếp liên tiếp nhau một cách lười biếng (như 0-16, rồi 16-24, rồi 24-30). Giữa các câu nói nếu có khoảng trống im lặng, nhạc đệm hoặc ngắt giọng từ 0.5 giây trở lên, bạn phải tạo ra KHOẢNG TRỐNG THỜI GIAN tương ứng. Mốc bắt đầu của câu tiếp theo phải là lúc nhân vật BẮT ĐẦU NÓI câu tiếp theo đó, KHÔNG được bắt đầu ngay khi câu trước vừa kết thúc.
3. Đảm bảo thời gian bắt đầu (start time) và kết thúc (end time) của mỗi câu phụ đề khớp chính xác đến từng mili giây với tiếng nói thực tế trong âm thanh gốc của nhân vật.

CHỈ trả về duy nhất chuỗi nội dung SRT thuần túy. Tuyệt đối không giải thích gì thêm, không bọc trong thẻ code markdown \`\`\`srt hay bất kỳ ký tự nào khác ngoài định dạng SRT.`;

              const geminiUrl = effectiveGeminiKey === 'SERVER_KEY'
                ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SERVER_KEY'
                : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveGeminiKey}`;

              const response = await window.electron.ttsRequest(geminiUrl, {
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

              translatedText = textResult
                .replace(/```srt/gi, '')
                .replace(/```/g, '')
                .trim();

              addLog(`Đã dịch & trích xuất phụ đề thành công bằng Gemini 1.5 Flash!`, 'success');
            } else {
              throw new Error(
                'Tính năng lồng tiếng theo nhịp (SRT) bắt buộc phải có OpenAI/Groq Key hoặc Gemini API Key trong phần Cài đặt.'
              );
            }
          } catch (err) {
            addLog(`Lỗi trích xuất/dịch: ${err.message}`, 'error');
            throw err;
          }
        }

        if (options.reviewSrt) {
          addLog('Đang chờ người dùng kiểm tra và chỉnh sửa phụ đề...', 'process');
          setSrtText(translatedText);
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
          translatedText = editedSrt;
          addLog('Đã xác nhận phụ đề! Tiếp tục tiến trình remake...', 'success');
        }

        // Hàm parse SRT siêu robust, tự động nhận diện cả định dạng có hoặc không có số thứ tự
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

            // Quét qua các dòng để tìm dòng chứa mốc thời gian (chấp nhận cả dấu phẩy , và dấu chấm .)
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

        const srtBlocks = parseSRT(translatedText);
        externalAudioList = [];

        // 4. Tạo giọng đọc lồng tiếng mới cho từng đoạn
        try {
          addLog(
            `Đang tạo giọng lồng tiếng (${srtBlocks.length} câu) bằng ${options.ttsServer.toUpperCase()}...`,
            'process'
          );

          for (let i = 0; i < srtBlocks.length; i++) {
            const block = srtBlocks[i];
            if (!block.text.trim()) continue;

            let audioBlob;
            if (options.ttsServer === 'edge') {
              audioBlob = await TTSProvider.speakWithEdge(
                block.text,
                options.ttsVoice,
                1.0 // Bỏ chọn tốc độ voice, dùng mặc định 1.0 để tự nhiên nhất
              );
            } else if (options.ttsServer === 'google-cloud') {
              audioBlob = await TTSProvider.speakWithGoogleCloud(
                block.text,
                options.ttsVoice,
                effectiveGoogleKey,
                0,
                1.0 // Bỏ chọn tốc độ voice, dùng mặc định 1.0
              );
            } else if (options.ttsServer === 'fpt') {
              audioBlob = await TTSProvider.speakWithFPT(
                block.text,
                options.ttsVoice,
                effectiveFptKey,
                0 // 0 tương ứng với tốc độ 1.0 của FPT
              );
            } else if (options.ttsServer === 'elevenlabs') {
              audioBlob = await TTSProvider.speakWithElevenLabs(
                block.text,
                options.ttsVoice,
                effectiveElevenLabsKey
              );
            } else {
              audioBlob = await TTSProvider.getGoogleAudioBlob(block.text, options.targetLang);
            }

            let audioPath;
            if (window.electron) {
              const arrayBuffer = await audioBlob.arrayBuffer();
              audioPath = await window.electron.saveTempAudio(arrayBuffer);
            } else {
              const formData = new FormData();
              formData.append('file', audioBlob, `voice-${i}.mp3`);
              const uploadRes = await fetch('/api/save-temp-audio', {
                method: 'POST',
                body: formData,
              });
              if (!uploadRes.ok) {
                throw new Error('Không thể lưu file âm thanh tạm thời trên Cloud.');
              }
              const uploadData = await uploadRes.json();
              audioPath = uploadData.path;
            }

            // Tính toán thời gian bắt đầu chính xác:
            // Luôn chia cho speed vì mốc thời gian phụ đề (dù từ YouTube gốc hay AI trích xuất từ video gốc)
            // đều là của timeline video gốc.
            const finalStartMs = Math.round(block.startMs / (options.speed || 1.0));

            externalAudioList.push({ path: audioPath, startMs: finalStartMs });

            // Cập nhật progress giả lập
            if (i % 3 === 0) setProgress(50 + Math.floor((i / srtBlocks.length) * 20));
          }

          remakeOptions.externalAudioList = externalAudioList;
          addLog('Đã tạo xong toàn bộ giọng lồng tiếng AI theo nhịp.', 'success');
        } catch (ttsErr) {
          addLog('Lỗi tạo giọng đọc: ' + ttsErr.message, 'error');
        }

        setProgress(75);
      }

      // Step 3: Remake (Trộn video & lồng tiếng)
      let remakeRes;
      if (options.translate) {
        // Pass 2: Trộn âm thanh AI vào video đã remake ở Pass 1
        setProgress(85);
        setStatus('remaking');
        addLog('Pass 2: Đang trộn giọng đọc lồng tiếng AI vào video đã remake...', 'process');

        const finalRemakeOptions = {
          ...options,
          flip: false,
          colorShift: false,
          vignette: false,
          audioPitch: false,
          audioDelay: false,
          speed: 1.0, // Đặt là 1.0 vì video đã được lách & tăng tốc ở Pass 1 rồi
          externalAudioList: externalAudioList,
        };

        if (window.electron) {
          remakeRes = await window.electron.videoRemake(remakedNoVoicePath, finalRemakeOptions);
        } else {
          const response = await fetch('/api/video-remake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoPath: remakedNoVoicePath,
              options: JSON.stringify(finalRemakeOptions),
            }),
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Trộn video lồng tiếng thất bại.');
          }
          remakeRes = await response.json();
        }
      } else {
        // Chỉ chạy 1 Pass duy nhất lách bản quyền hình ảnh (nếu không dịch)
        setStatus('remaking');
        addLog('Đang tiến hành lách bản quyền & kết xuất video...', 'process');

        if (window.electron) {
          remakeRes = await window.electron.videoRemake(inputPath, remakeOptions);
        } else {
          const response = await fetch('/api/video-remake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoPath: inputPath,
              options: JSON.stringify(remakeOptions),
            }),
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Lách video thất bại trên Cloud.');
          }
          remakeRes = await response.json();
        }
      }

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
        targetLang: options.targetLang,
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

  return (
    <div className="tool-container video-remaker-container">
      <Card variant="borderless" className="tool-card">
        <header className="tool-header">
          <h1 className="tool-gradient-title">Smart Video Remaker</h1>
          <div className="tool-status-bar">
            <Zap size={18} style={{ color: '#f59e0b' }} />
            <span>Tải video đa nền tảng & Lách bản quyền Shorts/TikTok</span>
            <Divider type="vertical" />
            <Tag color="blue" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              v1.0.0
            </Tag>
          </div>
        </header>

        <Row gutter={[32, 32]}>
          <Col xs={24} lg={15}>
            <div className="remaker-main-section">
              <div className="section-label">
                <DownloadCloud size={18} />
                <span>Link Video Gốc</span>
              </div>
              <Input
                size="large"
                placeholder="Dán link Youtube, Douyin, TikTok, Facebook vào đây..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (status === 'done') {
                    setStatus('idle');
                    setProgress(0);
                  }
                }}
                className="custom-input"
                prefix={<ExternalLink size={16} color="#6366f1" />}
                style={{ marginBottom: 32 }}
              />

              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Lách bản quyền</span>
                  </div>
                  <div className="checkbox-group">
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ marginBottom: 6, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                        Cường độ lách bản quyền:
                      </p>
                      <Select
                        size="large"
                        value={options.remakeLevel || 'strong'}
                        style={{ width: '100%' }}
                        onChange={(val) => setOptions({ ...options, remakeLevel: val })}
                        options={[
                          { value: 'normal', label: 'Lách nhẹ (Phù hợp TikTok, Reels, Facebook)' },
                          { value: 'strong', label: 'Lách mạnh (Phù hợp YouTube Content ID)' },
                        ]}
                        className="custom-select"
                      />
                    </div>
                    <Checkbox
                      checked={options.flip}
                      onChange={(e) => setOptions({ ...options, flip: e.target.checked })}
                    >
                      Lật ngang video (Mirroring)
                    </Checkbox>
                    <Checkbox
                      checked={options.colorShift}
                      onChange={(e) => setOptions({ ...options, colorShift: e.target.checked })}
                    >
                      Thay đổi hệ màu (Color Shift)
                    </Checkbox>
                    <Checkbox
                      checked={options.vignette}
                      onChange={(e) => setOptions({ ...options, vignette: e.target.checked })}
                    >
                      Hiệu ứng góc tối (Vignette)
                    </Checkbox>
                    <Checkbox
                      checked={options.audioPitch}
                      onChange={(e) => setOptions({ ...options, audioPitch: e.target.checked })}
                    >
                      Thay đổi âm thông (Audio Pitch 2%)
                    </Checkbox>
                    <Checkbox
                      checked={options.audioDelay}
                      onChange={(e) => setOptions({ ...options, audioDelay: e.target.checked })}
                    >
                      Độ trễ âm thanh & tiếng vang (Delay & Echo)
                    </Checkbox>
                  </div>
                </Col>
                <Col span={24}>
                  <div className="section-label">
                    <Languages size={18} />
                    <span>Dịch & Tốc độ</span>
                  </div>
                  <div className="translate-settings">
                    <Checkbox
                      checked={options.translate}
                      onChange={(e) => setOptions({ ...options, translate: e.target.checked })}
                      style={{ marginBottom: 16 }}
                    >
                      Dịch sang ngôn ngữ khác
                    </Checkbox>

                    {options.translate && (
                      <div className="translate-options-box">
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Ngôn ngữ đích
                          </p>
                          <Select
                            size="large"
                            value={options.targetLang}
                            style={{ width: '100%' }}
                            onChange={(val) => setOptions({ ...options, targetLang: val })}
                            options={[
                              { value: 'vi', label: 'Tiếng Việt' },
                              { value: 'en', label: 'Tiếng Anh' },
                              { value: 'zh', label: 'Tiếng Trung' },
                            ]}
                            className="custom-select"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Server Lồng tiếng
                          </p>
                          <Select
                            size="large"
                            value={options.ttsServer}
                            style={{ width: '100%' }}
                            onChange={(val) => {
                              let defaultVoice = 'vi-VN-HoaiMyNeural';
                              if (val === 'fpt') defaultVoice = 'banmai';
                              if (val === 'google-cloud') defaultVoice = 'vi-VN-Neural2-A';
                              setOptions({ ...options, ttsServer: val, ttsVoice: defaultVoice });
                            }}
                            options={[
                              { label: 'Edge TTS (Free - Khuyên dùng)', value: 'edge' },
                              { label: 'Google Dịch (Cơ bản)', value: 'google' },
                              { label: 'Google Cloud (Chuyên nghiệp)', value: 'google-cloud' },
                              { label: 'FPT.AI', value: 'fpt' },
                              { label: 'ElevenLabs', value: 'elevenlabs' },
                            ]}
                            className="custom-select"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Giọng đọc lồng tiếng
                          </p>
                          <Select
                            size="large"
                            value={options.ttsVoice}
                            style={{ width: '100%' }}
                            onChange={(val) => setOptions({ ...options, ttsVoice: val })}
                            options={
                              options.ttsServer === 'edge'
                                ? [
                                    {
                                      label: 'Nữ - Hoài My (Edge)',
                                      value: 'vi-VN-HoaiMyNeural',
                                    },
                                    {
                                      label: 'Nam - Nam Minh (Edge)',
                                      value: 'vi-VN-NamMinhNeural',
                                    },
                                    {
                                      label: 'Nữ - Phương Mỹ (Edge)',
                                      value: 'vi-VN-PhuongMyNeural',
                                    },
                                    {
                                      label: 'Nam - Mạnh Khôi (Edge)',
                                      value: 'vi-VN-ManhKhoiNeural',
                                    },
                                  ]
                                : options.ttsServer === 'fpt'
                                  ? [
                                      { label: 'Nữ - Ban Mai (FPT)', value: 'banmai' },
                                      { label: 'Nam - Lê Minh (FPT)', value: 'leminh' },
                                      { label: 'Nữ - Thu Minh (FPT)', value: 'thuminh' },
                                      { label: 'Nữ - Gia Huy (FPT)', value: 'giahuy' },
                                    ]
                                  : options.ttsServer === 'google-cloud'
                                    ? [
                                        { label: 'Nữ - Neural2-A', value: 'vi-VN-Neural2-A' },
                                        { label: 'Nam - Neural2-B', value: 'vi-VN-Neural2-B' },
                                        { label: 'Nữ - Wavenet-A', value: 'vi-VN-Wavenet-A' },
                                        { label: 'Nam - Wavenet-B', value: 'vi-VN-Wavenet-B' },
                                      ]
                                    : [{ label: 'Mặc định', value: 'default' }]
                            }
                            className="custom-select"
                          />
                        </div>
                      </div>
                    )}

                    {options.translate && (
                      <div style={{ marginTop: 12, marginBottom: 16 }}>
                        <Checkbox
                          checked={options.reviewSrt}
                          onChange={(e) => setOptions({ ...options, reviewSrt: e.target.checked })}
                        >
                          Kiểm tra & Sửa phụ đề trước khi lồng tiếng
                        </Checkbox>
                      </div>
                    )}

                    <Select
                      size="large"
                      defaultValue={1.05}
                      style={{ width: '100%' }}
                      onChange={(val) => setOptions({ ...options, speed: val })}
                      options={[
                        { value: 1, label: 'Tốc độ: 1.0x (Gốc)' },
                        { value: 1.05, label: 'Tốc độ: 1.05x (Khuyên dùng)' },
                        { value: 1.1, label: 'Tốc độ: 1.1x' },
                      ]}
                      className="custom-select"
                    />
                  </div>
                </Col>
              </Row>

              <div className="action-footer" style={{ marginTop: 48 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={!loading && <Zap size={18} />}
                  onClick={handleStart}
                  loading={loading}
                  className="process-btn"
                >
                  {loading ? 'Đang xử lý...' : 'Bắt đầu Remake Video'}
                </Button>
              </div>

              {(loading || status !== 'idle') && (
                <div className="progress-section">
                  <div className="progress-label">
                    <Text strong>
                      {status === 'downloading'
                        ? 'Đang tải...'
                        : status === 'remaking'
                          ? 'Đang remake...'
                          : 'Hoàn thành'}
                    </Text>
                    <Text>{progress}%</Text>
                  </div>
                  <Progress percent={progress} strokeColor="#6366f1" />
                </div>
              )}
            </div>
          </Col>

          <Col xs={24} lg={9}>
            <div className="remaker-sidebar">
              <Card
                className="logs-card-inner"
                title={
                  <div className="card-title">
                    <Info size={16} />
                    <span>Nhật ký xử lý</span>
                  </div>
                }
              >
                <div className="logs-container">
                  {logs.length === 0 ? (
                    <div className="empty-logs">Chưa có hoạt động nào.</div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className={`log-item ${log.type}`}>
                        <span className="log-time">[{log.time}]</span>
                        <span className="log-msg">{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card
                className="history-card-inner"
                style={{ marginTop: 24 }}
                title={
                  <div className="card-title">
                    <History size={16} />
                    <span>Lịch sử Remake</span>
                  </div>
                }
              >
                <div className="history-container">
                  {history.length === 0 ? (
                    <div className="empty-history">Chưa có lịch sử remake.</div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-header">
                          <span className="history-time">{item.time}</span>
                          <span className="history-lang">
                            Dịch: {item.targetLang.toUpperCase()}
                          </span>
                        </div>
                        <div className="history-url" title={item.url}>
                          {item.url}
                        </div>
                        <div className="history-path" title={item.outputPath}>
                          Lưu: {getBasename(item.outputPath)}
                        </div>
                        <div className="history-actions">
                          <Button
                            type="text"
                            size="small"
                            icon={<ExternalLink size={12} />}
                            onClick={() => {
                              setUrl(item.url);
                              message.success('Đã nạp lại link video!');
                            }}
                          >
                            Dùng lại link
                          </Button>
                          <Button
                            type="text"
                            size="small"
                            icon={<FolderOpen size={12} />}
                            onClick={() => {
                              window.electron.showItemInFolder(item.outputPath);
                            }}
                          >
                            Mở thư mục
                          </Button>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 size={12} />}
                            onClick={() => {
                              setHistory((prev) => {
                                const updated = prev.filter((h) => h.id !== item.id);
                                localStorage.setItem(
                                  'video_remake_history',
                                  JSON.stringify(updated)
                                );
                                return updated;
                              });
                              message.success('Đã xóa lịch sử!');
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {(!envStatus.ffmpeg || !envStatus.ytdlp) && (
                <Card
                  className="warning-card-inner"
                  style={{ marginTop: 24, border: '1px solid #fee2e2', background: '#fef2f2' }}
                >
                  <Title level={5} style={{ color: '#dc2626' }}>
                    <Info size={16} /> Yêu cầu cài đặt
                  </Title>
                  <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                    {!envStatus.ffmpeg && (
                      <p>
                        • <b>FFmpeg</b>: Cần thiết để remake video. Tải tại{' '}
                        <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">
                          ffmpeg.org
                        </a>
                      </p>
                    )}
                    {!envStatus.ytdlp && (
                      <p>
                        • <b>yt-dlp</b>: Cần thiết để tải video. Tải tại{' '}
                        <a
                          href="https://github.com/yt-dlp/yt-dlp/releases"
                          target="_blank"
                          rel="noreferrer"
                        >
                          GitHub
                        </a>
                      </p>
                    )}
                    <p style={{ marginTop: 8, fontWeight: 500 }}>
                      Sau khi cài đặt, hãy thêm vào <b>PATH</b> hệ thống và khởi động lại ứng dụng.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <History size={20} color="#6366f1" />
            <span>Kiểm tra & Hiệu chỉnh Phụ đề Lồng tiếng</span>
          </div>
        }
        open={showSrtModal}
        onOk={() => {
          if (window.resolveSrtPromise) {
            window.resolveSrtPromise(srtText);
          }
          setShowSrtModal(false);
        }}
        onCancel={() => {
          if (window.rejectSrtPromise) {
            window.rejectSrtPromise(new Error('Đã hủy bởi người dùng.'));
          }

          setShowSrtModal(false);
        }}
        okText="Xác nhận & Tiếp tục Remake"
        cancelText="Hủy bỏ"
        width={700}
        maskClosable={false}
        destroyOnClose
      >
        <p style={{ color: '#64748b', marginBottom: 12 }}>
          Dưới đây là phụ đề (định dạng SRT) đã được AI trích xuất và dịch từ video gốc. Bạn có thể
          chỉnh sửa lại bản dịch hoặc điều chỉnh mốc thời gian để khớp voice hoàn hảo nhất:
        </p>
        <Input.TextArea
          rows={16}
          value={srtText}
          onChange={(e) => setSrtText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '13px', borderRadius: '12px' }}
          placeholder="1
00:00:01,000 --> 00:00:04,000
Xin chào các bạn..."
        />
      </Modal>
    </div>
  );
};

export default VideoRemaker;
