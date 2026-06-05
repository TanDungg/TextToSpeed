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
    ttsSpeed: 1.0,
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

      // Step 2: Translate
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

        const firstRemakeRes = await VideoRemakerService.videoRemake(inputPath, firstRemakeOptions);

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

              const transRes = await VideoRemakerService.ttsRequest(translateUrl, {
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

              const response = await VideoRemakerService.ttsRequest(geminiUrl, {
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
          // Trích xuất âm thanh từ video gốc
          addLog('Đang trích xuất âm thanh từ video gốc...', 'process');
          const extractRes = await VideoRemakerService.extractAudio(inputPath);
          if (!extractRes.ok) throw new Error('Không thể trích xuất âm thanh từ video gốc.');

          try {
            if (effectiveOpenAIKey) {
              const isGroq = effectiveOpenAIKey.startsWith('gsk_');
              const providerName = isGroq ? 'Groq' : (effectiveOpenAIKey === 'SERVER_KEY' ? 'Server OpenAI' : 'OpenAI');

              addLog(
                `Đang nhận diện giọng nói bằng AI Whisper của ${providerName} (SRT Format)...`,
                'process'
              );
              const sttRes = await VideoRemakerService.transcribeAudio(
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

                const transRes = await VideoRemakerService.ttsRequest(translateUrl, {
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
              addLog(
                'Đang sử dụng Google Gemini 1.5 Flash để trích xuất & dịch phụ đề trực tiếp từ âm thanh (Free)...',
                'process'
              );

              const base64Res = await VideoRemakerService.readFileBase64(extractRes.path);
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
...
CHỈ trả về duy nhất chuỗi nội dung SRT thuần túy. Tuyệt đối không giải thích gì thêm, không bọc trong thẻ code markdown \`\`\`srt hay bất kỳ ký tự nào khác ngoài định dạng SRT.`;

              const geminiUrl = effectiveGeminiKey === 'SERVER_KEY'
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

        const srtBlocks = parseSRT(translatedText);
        externalAudioList = [];

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
                1.0
              );
            } else if (options.ttsServer === 'google-cloud') {
              audioBlob = await TTSProvider.speakWithGoogleCloud(
                block.text,
                options.ttsVoice,
                effectiveGoogleKey,
                0,
                1.0
              );
            } else if (options.ttsServer === 'fpt') {
              audioBlob = await TTSProvider.speakWithFPT(
                block.text,
                options.ttsVoice,
                effectiveFptKey,
                0
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

            const audioPath = await VideoRemakerService.saveTempAudio(audioBlob);

            const finalStartMs = Math.round(block.startMs / (options.speed || 1.0));
            externalAudioList.push({ path: audioPath, startMs: finalStartMs });

            if (i % 3 === 0) setProgress(50 + Math.floor((i / srtBlocks.length) * 20));
          }

          remakeOptions.externalAudioList = externalAudioList;
          addLog('Đã tạo xong toàn bộ giọng lồng tiếng AI theo nhịp.', 'success');
        } catch (ttsErr) {
          addLog('Lỗi tạo giọng đọc: ' + ttsErr.message, 'error');
        }

        setProgress(75);
      }

      // Step 3: Remake
      let remakeRes;
      if (options.translate) {
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

        remakeRes = await VideoRemakerService.videoRemake(remakedNoVoicePath, finalRemakeOptions);
      } else {
        setStatus('remaking');
        addLog('Đang tiến hành lách bản quyền & kết xuất video...', 'process');
        remakeRes = await VideoRemakerService.videoRemake(inputPath, remakeOptions);
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
