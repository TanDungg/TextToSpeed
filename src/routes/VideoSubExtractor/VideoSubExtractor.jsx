import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Slider,
  Switch,
  Segmented,
  Row,
  Col,
  Divider,
  Tag,
  message,
  Typography,
  Progress,
  Input,
  Tooltip,
} from 'antd';
import {
  Sparkles,
  UploadCloud,
  Video,
  Settings,
  Trash2,
  ListRestart,
  Sliders,
  Cpu,
  Download,
  Copy,
  Play,
  Pause,
  StopCircle,
  Edit3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { BASE_URL_API } from '../../constants/config';
import VideoRemakerService from '../../_service/videoRemaker.service';
import './VideoSubExtractorStyles.scss';

const { Title, Text } = Typography;

// Helper function to format seconds into SRT time format: HH:MM:SS,ms
const formatSrtTime = (seconds) => {
  const pad = (num, size = 2) => ('000' + num).slice(-size);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
};

// Helper function to format seconds into WebVTT time format: HH:MM:SS.ms
const formatVttTime = (seconds) => {
  const pad = (num, size = 2) => ('000' + num).slice(-size);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
};

// Simple Jaccard similarity index for text similarity
const getTextSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const s1 = new Set(str1.toLowerCase().split(/\s+/));
  const s2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
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
          id: Date.now() + Math.random(),
          index: result.length + 1,
          startTime: startMs / 1000,
          endTime: endMs / 1000,
          text: cleanText,
        });
      }
    }
  }
  return result;
};

const VideoSubExtractor = ({ settings }) => {
  const [selectedFile, setSelectedFile] = useState(null); // { name, path, type, size, fileObject }
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);

  // Mode: 'ocr' | 'stt'
  const [extractMode, setExtractMode] = useState('ocr');
  // STT engine: 'groq' | 'openai'
  const [sttEngine, setSttEngine] = useState('groq');

  // API keys
  const activeOpenaiKey = settings?.openaiKey || (localStorage.getItem('tts_settings') ? JSON.parse(localStorage.getItem('tts_settings')).openaiKey : '') || '';
  const activeGroqKey = settings?.groqKey || (localStorage.getItem('tts_settings') ? JSON.parse(localStorage.getItem('tts_settings')).groqKey : '') || '';

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanTime, setCurrentScanTime] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [logs, setLogs] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [activeSubIndex, setActiveSubIndex] = useState(-1);

  // Stats
  const [scanSpeed, setScanSpeed] = useState(0); // fps or frames per sec
  const [eta, setEta] = useState(null);

  // References
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const scanCancelRef = useRef(false);

  // AI Preprocessing and Preview States
  const [preprocessImage, setPreprocessImage] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [binarizeThreshold, setBinarizeThreshold] = useState(170);

  // OCR Configurations
  const [ocrLang, setOcrLang] = useState('vie+eng'); // 'vie+eng' | 'vie' | 'eng' | 'chi_sim'
  const [scanInterval, setScanInterval] = useState(1.0); // every N seconds
  const [minConfidence, setMinConfidence] = useState(55); // ignore OCR output below this %
  const [cropTop, setCropTop] = useState(78); // Y-axis offset percentage (where sub starts)
  const [cropHeight, setCropHeight] = useState(18); // height of sub box percentage

  // Clear logs helper
  const addLog = (text, type = 'process') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text, type }]);
  };

  // Update AI OCR Crop Preview in real-time
  const updateCropPreview = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Wait until video metadata dimensions are available
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const ctx = canvas.getContext('2d');
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    const sy = Math.floor((cropTop / 100) * vHeight);
    const sh = Math.floor((cropHeight / 100) * vHeight);

    canvas.width = vWidth;
    canvas.height = sh;

    try {
      ctx.drawImage(video, 0, sy, vWidth, sh, 0, 0, vWidth, sh);

      // Preprocess image to enhance OCR accuracy (Binarization filter)
      if (preprocessImage) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Grayscale conversion (Luma weights)
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Clean thresholding (binarize)
          const value = gray > binarizeThreshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.warn('Failed to update crop preview:', err);
    }
  };

  // Run preview updates when adjustments are made
  useEffect(() => {
    const timer = setTimeout(() => {
      updateCropPreview();
    }, 80);
    return () => clearTimeout(timer);
  }, [cropTop, cropHeight, preprocessImage, binarizeThreshold, videoUrl]);

  // Pre-load Tesseract Worker when scanning starts
  const initTesseract = async (lang) => {
    if (workerRef.current) return workerRef.current;
    
    addLog(`Đang khởi tạo AI OCR Tesseract cho ngôn ngữ [${lang.toUpperCase()}]...`, 'process');
    try {
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress % 0.2 === 0) {
            // Can be used for fine-grained progress logging if needed
          }
        }
      });
      workerRef.current = worker;
      addLog('Đã khởi tạo AI OCR Tesseract thành công!', 'success');
      return worker;
    } catch (error) {
      addLog(`Lỗi khởi tạo OCR: ${error.message}`, 'error');
      throw error;
    }
  };

  const handleSelectVideo = async () => {
    const isElectron = window.electron && !window.electron.isWebMock;

    if (isElectron) {
      try {
        const res = await window.electron.selectFile('video');
        if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
          return;
        }

        const filePath = res.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        const isVid = ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(extension);

        if (!isVid) {
          message.error('Chỉ hỗ trợ định dạng video (MP4, MKV, AVI, MOV, WEBM).');
          return;
        }

        setSelectedFile({
          name: fileName,
          path: filePath,
          extension: extension,
        });

        // Stream local media via media:// custom protocol
        const streamUrl = `media://${filePath.replace(/\\/g, '/')}`;
        setVideoUrl(streamUrl);
        
        // Reset scanning states
        setSubtitles([]);
        setProgressPercent(0);
        setLogs([]);
        setEta(null);
        setCurrentScanTime(0);

        addLog(`Đã tải video: ${fileName}`, 'success');
        message.success('Tải video thành công!');
      } catch (error) {
        message.error('Không thể chọn video: ' + error.message);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const extension = file.name.split('.').pop().toLowerCase();
          setSelectedFile({
            name: file.name,
            path: '',
            extension: extension,
            fileObject: file,
          });
          setVideoUrl(URL.createObjectURL(file));

          // Reset scanning states
          setSubtitles([]);
          setProgressPercent(0);
          setLogs([]);
          setEta(null);
          setCurrentScanTime(0);

          addLog(`Đã tải video: ${file.name}`, 'success');
          message.success('Tải video thành công!');
        }
      };
      input.click();
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 0);
      setTimeout(() => {
        updateCropPreview();
      }, 200);
    }
  };

  // Interactive Time Seeking when clicking on subtitle segment
  const handleSeekToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
      setTimeout(() => {
        if (videoRef.current) videoRef.current.pause();
      }, 3000); // play for 3 seconds then pause
    }
  };

  // Seek helper returned as Promise to wait for video layout repaint
  const seekToPromise = (time) => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) {
        resolve();
        return;
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        // Add tiny timeout to allow chromium to paint the frame
        setTimeout(resolve, 80);
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  };

  const startSubtitleExtraction = async () => {
    if (!selectedFile || !videoRef.current || !canvasRef.current) {
      message.warning('Vui lòng chọn tệp video trước!');
      return;
    }

    setIsScanning(true);
    scanCancelRef.current = false;
    setSubtitles([]);
    setLogs([]);
    addLog('Bắt đầu quy trình trích xuất phụ đề cứng (Video OCR)...', 'process');

    let worker = null;
    try {
      worker = await initTesseract(ocrLang);
    } catch (err) {
      message.error('Không thể bắt đầu OCR. Kiểm tra cấu hình kết nối mạng để tải mô hình ngôn ngữ.');
      setIsScanning(false);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const duration = video.duration;

    const interval = scanInterval;
    let currentSec = 0;

    let localSubtitles = [];
    let currentActiveSub = null;

    const startTime = Date.now();
    let processedFramesCount = 0;

    while (currentSec < duration && !scanCancelRef.current) {
      setCurrentScanTime(currentSec);
      setProgressPercent(Math.round((currentSec / duration) * 100));

      // Seek video to specific timestamp and wait for seeked event
      await seekToPromise(currentSec);

      // Perform canvas crop drawing
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // Crop coordinates mapping
      const sy = Math.floor((cropTop / 100) * vHeight);
      const sh = Math.floor((cropHeight / 100) * vHeight);
      
      // Standardize canvas dimensions matching crop ratio
      canvas.width = vWidth;
      canvas.height = sh;

      // Draw the cropped portion to Canvas
      ctx.drawImage(video, 0, sy, vWidth, sh, 0, 0, vWidth, sh);

      // Preprocess image to enhance OCR accuracy (Binarization filter)
      if (preprocessImage) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Grayscale conversion (Luma weights)
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Clean thresholding (binarize)
          const value = gray > binarizeThreshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // Update OCR Crop Preview dynamically during scanning
      try {
        setPreviewUrl(canvas.toDataURL('image/png'));
      } catch (previewErr) {
        // Fail-silent for preview generation during scan loop
      }

      // Perform OCR
      try {
        const result = await worker.recognize(canvas);
        const text = result.data.text ? result.data.text.trim() : '';
        const confidence = result.data.confidence;

        processedFramesCount++;
        
        // Calculate scanning speed & ETA
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = processedFramesCount / elapsed;
        setScanSpeed(speed);
        
        const remainingFrames = Math.ceil((duration - currentSec) / interval);
        const estimatedRemainingSec = speed > 0 ? remainingFrames / speed : 0;
        setEta(Math.round(estimatedRemainingSec));

        // Processing recognized text
        // Clean line breaks and formatting
        const cleanText = text
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (confidence >= minConfidence && cleanText.length >= 2) {
          addLog(`[${formatSrtTime(currentSec).split(',')[0]}] Quét: "${cleanText}" (Độ tin cậy: ${confidence}%)`, 'process');
          
          if (currentActiveSub) {
            // Check similarity with the current subtitle
            const similarity = getTextSimilarity(currentActiveSub.text, cleanText);
            
            if (similarity > 0.65 || cleanText.toLowerCase().includes(currentActiveSub.text.toLowerCase()) || currentActiveSub.text.toLowerCase().includes(cleanText.toLowerCase())) {
              // Same subtitle line running - extend end time
              currentActiveSub.endTime = currentSec + interval;
              // If OCR text is longer/better, update it
              if (cleanText.length > currentActiveSub.text.length) {
                currentActiveSub.text = cleanText;
              }
              
              // Update local state directly
              localSubtitles[localSubtitles.length - 1] = { ...currentActiveSub };
              setSubtitles([...localSubtitles]);
            } else {
              // Seal previous subtitle and start a new one
              currentActiveSub = {
                id: Date.now() + processedFramesCount,
                index: localSubtitles.length + 1,
                startTime: currentSec,
                endTime: currentSec + interval,
                text: cleanText,
              };
              localSubtitles.push(currentActiveSub);
              setSubtitles([...localSubtitles]);
            }
          } else {
            // Start the first subtitle block
            currentActiveSub = {
              id: Date.now() + processedFramesCount,
              index: 1,
              startTime: currentSec,
              endTime: currentSec + interval,
              text: cleanText,
            };
            localSubtitles.push(currentActiveSub);
            setSubtitles([...localSubtitles]);
          }
        } else {
          // If some text was found but filtered out due to low confidence
          if (cleanText.length >= 2) {
            addLog(`[${formatSrtTime(currentSec).split(',')[0]}] Bỏ qua: "${cleanText}" (Độ tin cậy thấp: ${confidence}% < ${minConfidence}%)`, 'error');
          }
          
          // If OCR returned empty or very low confidence, seal current subtitle (it ended)
          if (currentActiveSub) {
            currentActiveSub = null;
          }
        }
      } catch (ocrError) {
        addLog(`Lỗi quét tại giây thứ ${currentSec.toFixed(1)}: ${ocrError.message}`, 'error');
      }

      currentSec += interval;
    }

    setProgressPercent(100);
    setIsScanning(false);
    
    if (scanCancelRef.current) {
      addLog('Đã hủy tiến trình trích xuất phụ đề theo yêu cầu.', 'error');
      message.warning('Đã dừng quét phụ đề.');
    } else {
      addLog(`Hoàn tất trích xuất thành công! Tìm thấy ${localSubtitles.length} dòng phụ đề.`, 'success');
      message.success(`Hoàn tất trích xuất! Tìm thấy ${localSubtitles.length} dòng.`);
    }
  };

  const startAudioSTTExtraction = async () => {
    if (!selectedFile) {
      message.warning('Vui lòng chọn tệp video trước!');
      return;
    }

    const isElectron = window.electron && !window.electron.isWebMock;
    const isWeb = !isElectron;
    const apiKey = sttEngine === 'groq'
      ? (activeGroqKey || (isWeb ? 'SERVER_KEY' : ''))
      : (activeOpenaiKey || (isWeb ? 'SERVER_KEY' : ''));

    if (!isWeb && !apiKey) {
      message.error(`Vui lòng cấu hình API Key cho ${sttEngine === 'groq' ? 'Groq' : 'OpenAI'} trong phần Cài đặt.`);
      return;
    }

    setIsScanning(true);
    scanCancelRef.current = false;
    setSubtitles([]);
    setLogs([]);
    setProgressPercent(10);
    addLog(`Bắt đầu trích xuất bằng AI Whisper của ${sttEngine.toUpperCase()}...`, 'process');

    try {
      let videoPathOnServer = '';
      if (isWeb) {
        if (!selectedFile.fileObject) {
          throw new Error('Không tìm thấy tệp video để tải lên.');
        }
        addLog('Đang tải tệp video lên máy chủ (có thể mất vài giây)...', 'process');
        
        const formData = new FormData();
        formData.append('file', selectedFile.fileObject);
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
        
        const uploadRes = await fetch(`${BASE_URL_API}/api/video/upload-audio-segment`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload video thất bại: ${uploadRes.status}`);
        }
        const uploadData = await uploadRes.json();
        if (!uploadData.ok) {
          throw new Error(uploadData.error || 'Tải video lên server thất bại.');
        }
        videoPathOnServer = uploadData.path;
        addLog('Tải video lên server thành công!', 'success');
        setProgressPercent(30);
      } else {
        videoPathOnServer = selectedFile.path;
      }

      // Extract Audio
      addLog('Đang tiến hành trích xuất âm thanh từ video...', 'process');
      let extractRes = null;
      if (isElectron) {
        extractRes = await window.electron.extractAudio(videoPathOnServer);
      } else {
        extractRes = await VideoRemakerService.extractAudio(videoPathOnServer, settings);
      }

      if (!extractRes.ok) {
        throw new Error(extractRes.error || 'Trích xuất âm thanh thất bại.');
      }
      
      const audioPath = extractRes.path;
      addLog('Đã trích xuất tệp âm thanh thành công.', 'success');
      setProgressPercent(60);

      // Transcribe
      addLog(`Đang nhận diện giọng nói bằng AI Whisper...`, 'process');
      let transcribeRes = null;
      if (isElectron) {
        transcribeRes = await window.electron.transcribeAudio(audioPath, apiKey);
      } else {
        transcribeRes = await VideoRemakerService.transcribeAudio(audioPath, apiKey, { ...settings, provider: sttEngine });
      }

      if (!transcribeRes.ok) {
        throw new Error(transcribeRes.error || 'Chuyển giọng nói thành văn bản thất bại.');
      }

      const srtText = transcribeRes.text;
      addLog('Đã hoàn tất nhận diện giọng nói!', 'success');
      setProgressPercent(90);

      // Parse
      const parsed = parseSRT(srtText);
      setSubtitles(parsed);
      setProgressPercent(100);
      addLog(`Hoàn tất trích xuất! Tìm thấy ${parsed.length} dòng phụ đề.`, 'success');
      message.success(`Dịch giọng nói thành công! Tìm thấy ${parsed.length} dòng.`);
    } catch (err) {
      addLog(`Lỗi xử lý Audio STT: ${err.message}`, 'error');
      message.error(err.message);
      setProgressPercent(0);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStopExtraction = () => {
    scanCancelRef.current = true;
  };

  const handleEditSubtitle = (id, newText) => {
    setSubtitles((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, text: newText } : sub))
    );
  };

  const handleDeleteSubtitle = (id) => {
    setSubtitles((prev) =>
      prev
        .filter((sub) => sub.id !== id)
        .map((sub, idx) => ({ ...sub, index: idx + 1 }))
    );
  };

  // Subtitle Export functions
  const handleExportSRT = () => {
    if (subtitles.length === 0) {
      message.warning('Chưa có phụ đề để xuất!');
      return;
    }

    let content = '';
    subtitles.forEach((sub) => {
      content += `${sub.index}\n`;
      content += `${formatSrtTime(sub.startTime)} --> ${formatSrtTime(sub.endTime)}\n`;
      content += `${sub.text}\n\n`;
    });

    downloadLocalFile(content, `${selectedFile.name.split('.')[0]}.srt`);
    message.success('Đã xuất file SRT phụ đề thành công!');
  };

  const handleExportVTT = () => {
    if (subtitles.length === 0) {
      message.warning('Chưa có phụ đề để xuất!');
      return;
    }

    let content = 'WEBVTT\n\n';
    subtitles.forEach((sub) => {
      content += `${sub.index}\n`;
      content += `${formatVttTime(sub.startTime)} --> ${formatVttTime(sub.endTime)}\n`;
      content += `${sub.text}\n\n`;
    });

    downloadLocalFile(content, `${selectedFile.name.split('.')[0]}.vtt`);
    message.success('Đã xuất file WebVTT thành công!');
  };

  const handleExportTXT = () => {
    if (subtitles.length === 0) {
      message.warning('Chưa có văn bản để xuất!');
      return;
    }

    // Join all extracted text blocks together
    const content = subtitles.map((sub) => sub.text).join('\n');
    downloadLocalFile(content, `${selectedFile.name.split('.')[0]}_text.txt`);
    message.success('Đã xuất tệp văn bản thành công!');
  };

  const handleCopyClipboard = () => {
    if (subtitles.length === 0) {
      message.warning('Chưa có nội dung để sao chép!');
      return;
    }

    const content = subtitles.map((sub) => sub.text).join('\n');
    navigator.clipboard.writeText(content);
    message.success('Đã sao chép toàn bộ phụ đề vào Clipboard!');
  };

  const downloadLocalFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Close Tesseract worker on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return (
    <div className="tool-container video-sub-extractor-container">
      <Card variant="borderless" className="tool-card">
        {isScanning && (
          <div className="tool-card-overlay">
            <div className="premium-spinner" />
            <div className="tool-card-overlay-text">AI đang trích xuất phụ đề video...</div>
            <div className="tool-card-overlay-subtext">
              Hệ thống đang tiến hành quét Tesseract OCR nội bộ trên từng khung hình. Bạn có thể dừng tiến trình bất cứ lúc nào.
            </div>
            <div className="overlay-progress-container">
              <Progress percent={progressPercent} strokeColor="#0d9488" />
            </div>
            <Button
              type="primary"
              danger
              onClick={handleStopExtraction}
              className="overlay-cancel-btn"
            >
              HỦY QUÉT PHỤ ĐỀ
            </Button>
          </div>
        )}
        <header className="tool-header">
          <h1 className="tool-gradient-title">AI Video Subtitle OCR</h1>
          <div className="tool-status-bar">
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
            <span>Trích xuất dòng chữ phụ đề cứng chạy trong video</span>
            <Divider type="vertical" />
            <Tag color="purple" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              v1.0.0 (Local AI)
            </Tag>
          </div>
        </header>

        <Row gutter={[32, 32]}>
          {/* Main workspace section */}
          <Col xs={24} lg={15} className="extractor-main-section">
            <div className="section-label">
              <Video size={18} /> Nhập Video Cần Trích Xuất
            </div>

            {!selectedFile ? (
              <div className="upload-area" onClick={handleSelectVideo}>
                <UploadCloud size={48} />
                <div className="upload-title">Nhấp để chọn Video từ máy tính</div>
                <div className="upload-desc">
                  Hỗ trợ định dạng video (MP4, MKV, AVI, MOV, WEBM)
                </div>
              </div>
            ) : (
              <div className="file-preview-card">
                <div className="preview-header">
                  <span className="file-name">{selectedFile.name}</span>
                  <Button
                    type="text"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={() => {
                      setSelectedFile(null);
                      setVideoUrl('');
                      setSubtitles([]);
                    }}
                    disabled={isScanning}
                  >
                    Xóa video
                  </Button>
                </div>

                {/* Video layout showing interactive crop-zone */}
                <div className="video-crop-wrapper">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls={!isScanning}
                    onLoadedMetadata={handleVideoLoaded}
                    onSeeked={updateCropPreview}
                  />
                  
                  {/* Interactive Visual Crop Zone */}
                  {extractMode === 'ocr' && (
                    <div
                      className={`crop-overlay ${isScanning ? 'scanning' : ''}`}
                      style={{
                        top: `${cropTop}%`,
                        height: `${cropHeight}%`,
                      }}
                    >
                      <div className="crop-label">Vùng Phụ Đề Quét OCR</div>
                      <div className="laser-line"></div>
                    </div>
                  )}
                </div>

                <div className="file-details">
                  <span className="detail-item">Thời lượng: {videoDuration.toFixed(1)} giây</span>
                  <span className="detail-item">Định dạng: {selectedFile.extension.toUpperCase()}</span>
                  <span className="detail-item">Đường dẫn: {selectedFile.path}</span>
                </div>
              </div>
            )}

            {selectedFile && (
              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px', color: '#0d9488' }}>
                  Phương thức trích xuất phụ đề:
                </div>
                <Segmented
                  block
                  size="large"
                  value={extractMode}
                  onChange={(val) => setExtractMode(val)}
                  options={[
                    { label: 'OCR chữ cứng chạy trên video (Local)', value: 'ocr' },
                    { label: 'Nhận diện giọng nói thành văn bản (Audio STT)', value: 'stt' },
                  ]}
                  disabled={isScanning}
                  className="custom-segmented"
                />
              </div>
            )}

            {/* Subtitle Crop Position Configuration */}
            {extractMode === 'ocr' && selectedFile && (
              <div className="crop-control-box">
                <div className="control-row">
                  <span className="control-title">
                    <Sliders size={15} style={{ color: '#ef4444' }} /> Vị trí vùng phụ đề (Từ trên xuống):
                  </span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>{cropTop}%</span>
                  <Slider
                    min={0}
                    max={95}
                    value={cropTop}
                    onChange={(val) => setCropTop(val)}
                    disabled={isScanning}
                    className="control-slider"
                    tooltip={{ formatter: (v) => `Top: ${v}%` }}
                  />
                </div>

                <div className="control-row">
                  <span className="control-title">
                    <Sliders size={15} style={{ color: '#ef4444' }} /> Chiều cao vùng quét:
                  </span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>{cropHeight}%</span>
                  <Slider
                    min={5}
                    max={40}
                    value={cropHeight}
                    onChange={(val) => setCropHeight(val)}
                    disabled={isScanning}
                    className="control-slider"
                    tooltip={{ formatter: (v) => `Height: ${v}%` }}
                  />
                </div>
              </div>
            )}

            {/* Real-time AI Crop Preview */}
            {extractMode === 'ocr' && selectedFile && (
              <div className="crop-preview-box">
                <div className="preview-title">
                  <Cpu size={16} /> Xem trước ảnh gửi AI (Thời gian thực):
                </div>
                <div className="preview-image-wrapper">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Vùng phụ đề cắt" />
                  ) : (
                    <span className="no-preview">Đang trích xuất ảnh xem trước...</span>
                  )}
                </div>
              </div>
            )}

            <Divider style={{ margin: '24px 0' }} />

            {/* OCR/STT Options Configuration */}
            <div className="section-label">
              <Settings size={18} /> {extractMode === 'ocr' ? 'Cài đặt thông số nhận diện OCR' : 'Cài đặt nhận diện giọng nói (STT)'}
            </div>

            <div className="settings-grid">
              {extractMode === 'ocr' ? (
                <Row gutter={[20, 20]}>
                  {/* Language Picker */}
                  <Col span={24}>
                    <div className="extractor-option-box">
                      <div className="option-header">
                        <span className="option-title">Ngôn ngữ quét</span>
                        <span className="option-value" style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>
                          {ocrLang === 'vie+eng' ? 'Tiếng Việt & Anh' : ocrLang === 'vie' ? 'Tiếng Việt' : ocrLang === 'eng' ? 'Tiếng Anh' : 'Tiếng Trung'}
                        </span>
                      </div>
                      <Segmented
                        block
                        value={ocrLang}
                        onChange={(val) => setOcrLang(val)}
                        options={[
                          { label: 'Việt + Anh', value: 'vie+eng' },
                          { label: 'Việt', value: 'vie' },
                          { label: 'Anh', value: 'eng' },
                          { label: 'Trung', value: 'chi_sim' },
                        ]}
                        disabled={isScanning}
                        className="custom-segmented"
                      />
                    </div>
                  </Col>

                  {/* Scan Speed/Interval */}
                  <Col span={24}>
                    <div className="extractor-option-box">
                      <div className="option-header">
                        <span className="option-title">Tần suất quét (Bước nhảy giây)</span>
                        <span className="option-value">Mỗi {scanInterval.toFixed(1)} giây</span>
                      </div>
                      <Slider
                        min={0.2}
                        max={3.0}
                        step={0.1}
                        value={scanInterval}
                        onChange={(val) => setScanInterval(val)}
                        disabled={isScanning}
                        className="custom-slider"
                        tooltip={{ formatter: (v) => `Mỗi ${v} giây` }}
                      />
                    </div>
                  </Col>

                  {/* Image Preprocessing Toggle */}
                  <Col span={24}>
                    <div className="extractor-option-box">
                      <div className="option-header" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="option-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={16} style={{ color: '#f59e0b' }} />
                          Tối ưu hóa ảnh quét AI (Nhị phân hóa sắc nét)
                        </span>
                        <Switch
                          checked={preprocessImage}
                          onChange={(val) => setPreprocessImage(val)}
                          disabled={isScanning}
                        />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4', marginBottom: preprocessImage ? '12px' : 0 }}>
                        Tự động chuyển đổi ảnh vùng cắt sang đen trắng sắc tương phản cao trước khi gửi cho AI. Khuyên dùng bật để tăng tỷ lệ đọc phụ đề cứng chuẩn xác &gt;98% và tránh nhiễu nền video.
                      </p>
                      {preprocessImage && (
                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                          <div className="option-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="option-title" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Ngưỡng lọc nhị phân (Độ tương phản chữ)</span>
                            <span className="option-value" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>{binarizeThreshold}</span>
                          </div>
                          <Slider
                            min={50}
                            max={240}
                            step={5}
                            value={binarizeThreshold}
                            onChange={(val) => setBinarizeThreshold(val)}
                            disabled={isScanning}
                            className="custom-slider"
                            style={{ margin: '8px 0 0 0' }}
                            tooltip={{ formatter: (v) => `Ngưỡng: ${v}` }}
                          />
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', lineHeight: '1.3' }}>
                            * Nếu phụ đề màu vàng/sáng: giảm xuống (120-150). Nếu phụ đề màu trắng sáng/nền tối: tăng lên (180-210) để nét hơn. Xem ảnh trực tiếp ở ô Preview!
                          </div>
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Confidence threshold */}
                  <Col span={24}>
                    <div className="extractor-option-box">
                      <div className="option-header">
                        <span className="option-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Cpu size={16} style={{ color: '#0d9488' }} />
                          Độ tin cậy nhận diện tối thiểu (Lọc nhiễu)
                        </span>
                        <span className="option-value">
                          {minConfidence}%
                        </span>
                      </div>
                      <Slider
                        min={30}
                        max={90}
                        step={5}
                        value={minConfidence}
                        onChange={(val) => setMinConfidence(val)}
                        disabled={isScanning}
                        className="custom-slider"
                        tooltip={{ formatter: (v) => `Confidence >= ${v}%` }}
                      />
                    </div>
                  </Col>
                </Row>
              ) : (
                <Row gutter={[20, 20]}>
                  {/* STT Engine Picker */}
                  <Col span={24}>
                    <div className="extractor-option-box">
                      <div className="option-header">
                        <span className="option-title">Mô hình AI nhận diện giọng nói</span>
                        <span className="option-value" style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>
                          {sttEngine === 'groq' ? 'Groq Whisper (Free - Nhanh)' : 'OpenAI Whisper (Paid - Chuẩn)'}
                        </span>
                      </div>
                      <Segmented
                        block
                        value={sttEngine}
                        onChange={(val) => setSttEngine(val)}
                        options={[
                          { label: 'Groq (Miễn phí & Cực nhanh)', value: 'groq' },
                          { label: 'OpenAI (Trả phí & Chính xác)', value: 'openai' },
                        ]}
                        disabled={isScanning}
                        className="custom-segmented"
                      />
                    </div>
                  </Col>

                  {/* Engine Key Status Notice */}
                  <Col span={24}>
                    <div
                      style={{
                        background: sttEngine === 'groq' ? 'rgba(13, 148, 136, 0.05)' : 'rgba(59, 130, 246, 0.05)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: sttEngine === 'groq' ? '1px solid rgba(13, 148, 136, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
                        color: sttEngine === 'groq' ? '#0f766e' : '#1e40af',
                        fontSize: '12.5px',
                        lineHeight: '1.5'
                      }}
                    >
                      <Sparkles size={14} style={{ color: '#f59e0b', display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      {sttEngine === 'groq' ? (
                        <>
                          <b>Groq Whisper (Whisper-large-v3):</b> Nhận diện giọng nói siêu tốc trong vòng vài giây, hoàn toàn miễn phí. Đã tích hợp sẵn key dự phòng trên server nếu bạn không tự nhập trong phần Cài đặt.
                        </>
                      ) : (
                        <>
                          <b>OpenAI Whisper (Whisper-1):</b> Nhận diện giọng nói chất lượng cao nhất, tự động nhận biết ngôn ngữ gốc chuẩn xác. Bạn có thể sử dụng key OpenAI trả phí của mình hoặc hệ thống sẽ tự động dùng key server để xử lý.
                        </>
                      )}
                    </div>
                  </Col>
                </Row>
              )}
            </div>

            {/* Scan progress bar */}
            {isScanning && (
              <div className="progress-section">
                <div className="progress-label">
                  <span>AI đang tiến hành trích xuất phụ đề video...</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress percent={progressPercent} showInfo={false} strokeColor="var(--primary)" />
                <div className="progress-stats">
                  <span>Tốc độ quét: {scanSpeed > 0 ? `${scanSpeed.toFixed(1)} fps` : 'Đang tính...'}</span>
                  <span>Thời gian còn lại: {eta !== null ? (eta === 0 ? 'Hoàn tất' : `${eta} giây`) : 'Đang tính...'}</span>
                </div>
              </div>
            )}

            <div className="action-footer">
              {!isScanning ? (
                <Button
                  type="primary"
                  size="large"
                  disabled={!selectedFile}
                  onClick={extractMode === 'ocr' ? startSubtitleExtraction : startAudioSTTExtraction}
                  className="extractor-btn start-btn"
                  icon={<Sparkles size={20} />}
                >
                  {extractMode === 'ocr' ? 'BẮT ĐẦU TRÍCH XUẤT PHỤ ĐỀ' : 'BẮT ĐẦU NHẬN DIỆN GIỌNG NÓI'}
                </Button>
              ) : (
                <Button
                  type="primary"
                  danger
                  size="large"
                  onClick={handleStopExtraction}
                  className="extractor-btn stop-btn"
                  icon={<StopCircle size={20} />}
                >
                  {extractMode === 'ocr' ? 'DỪNG QUÉT PHỤ ĐỀ' : 'DỪNG NHẬN DIỆN GIỌNG NÓI'}
                </Button>
              )}
            </div>
          </Col>

          {/* Right workspace details column */}
          <Col xs={24} lg={9}>
            {/* Live scanning logs */}
            <div className="section-label">
              <Cpu size={18} /> {extractMode === 'ocr' ? 'Console Quét OCR' : 'Console Nhận diện Giọng nói'}
            </div>

            <Card variant="borderless" className="logs-card-inner">
              <div className="logs-container">
                {logs.length === 0 ? (
                  <div className="empty-logs">Chưa có dòng chữ nào được quét.</div>
                ) : (
                  [...logs].reverse().map((log, index) => (
                    <div key={index} className={`log-item ${log.type}`}>
                      <span className="log-time">[{log.time}]</span>
                      {log.text}
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Divider style={{ margin: '24px 0' }} />

            {/* Subtitles listing / Editor */}
            <div className="subtitles-card-inner">
              <div className="card-header-actions">
                <span className="sub-title">
                  <Edit3 size={18} /> Kết quả phụ đề ({subtitles.length} dòng)
                </span>
                {subtitles.length > 0 && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => setSubtitles([])}
                    disabled={isScanning}
                  >
                    Xóa hết
                  </Button>
                )}
              </div>

              <div className="subtitles-container">
                {subtitles.length === 0 ? (
                  <div className="empty-subs">Chưa phát hiện được phụ đề. Hãy bấm Bắt đầu trích xuất!</div>
                ) : (
                  subtitles.map((sub, index) => (
                    <div key={sub.id} className="subtitle-row">
                      <div className="sub-index">{sub.index}</div>
                      
                      <div className="sub-content-area">
                        <Tooltip title="Nhấp để nhảy video đến giây này">
                          <span
                            className="sub-time"
                            onClick={() => handleSeekToTime(sub.startTime)}
                          >
                            {formatSrtTime(sub.startTime).split(',')[0]} --&gt; {formatSrtTime(sub.endTime).split(',')[0]}
                          </span>
                        </Tooltip>

                        <input
                          type="text"
                          className="sub-input-text"
                          value={sub.text}
                          onChange={(e) => handleEditSubtitle(sub.id, e.target.value)}
                        />
                      </div>

                      <Button
                        type="text"
                        danger
                        shape="circle"
                        size="small"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleDeleteSubtitle(sub.id)}
                        className="delete-sub-btn"
                        disabled={isScanning}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Subtitle Export Action Center */}
              {subtitles.length > 0 && (
                <div className="export-section">
                  <Button
                    type="primary"
                    onClick={handleExportSRT}
                    className="export-btn"
                    icon={<Download size={16} />}
                  >
                    Xuất file SRT
                  </Button>
                  <Button
                    onClick={handleExportVTT}
                    className="export-btn"
                    icon={<Download size={16} />}
                  >
                    Xuất file VTT
                  </Button>
                  <Button
                    onClick={handleExportTXT}
                    className="export-btn"
                    icon={<Download size={16} />}
                  >
                    Xuất file TXT
                  </Button>
                  <Button
                    onClick={handleCopyClipboard}
                    className="export-btn"
                    icon={<Copy size={16} />}
                  >
                    Copy
                  </Button>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Hidden Canvas used for capturing video frames */}
      <canvas ref={canvasRef} className="hidden-canvas" />
    </div>
  );
};

export default VideoSubExtractor;
