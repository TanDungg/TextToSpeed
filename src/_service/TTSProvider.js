import axios from 'axios';

class TTSProvider {
  /**
   * OpenAI TTS
   */
  static async speakWithOpenAI(text, voice, apiKey, rate = 1) {
    if (!apiKey) throw new Error('Vui lòng cấu hình API Key OpenAI.');

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: text,
          voice: voice || 'alloy',
          speed: rate,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error(
          'Tài khoản OpenAI của bạn đã hết hạn mức hoặc bị giới hạn (Lỗi 429). Vui lòng kiểm tra lại tài khoản.'
        );
      }
      const errorMsg = error.response?.data?.error?.message || error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * FPT.AI TTS (V5 Standard)
   */
  static async speakWithFPT(text, voice, apiKey, speed = 0, pitch = 0) {
    if (!apiKey) throw new Error('Vui lòng cấu hình API Key FPT.AI.');

    let cleanText = text.replace(/[\n\r]+/g, ' ').trim();

    // Nếu có pitch, sử dụng SSML để FPT.AI hiểu được
    if (pitch !== 0) {
      const pitchPercent = pitch > 0 ? `+${pitch}%` : `${pitch}%`;
      cleanText = `<speak><prosody pitch="${pitchPercent}">${cleanText}</prosody></speak>`;
    }

    try {
      const targetUrl = `https://api.fpt.ai/hmi/tts/v5?v=${voice || 'banmai'}&t=${Date.now()}`;
      let data;

      if (window.electron && window.electron.ttsRequest) {
        const result = await window.electron.ttsRequest(targetUrl, {
          method: 'POST',
          headers: {
            api_key: apiKey,
            voice: voice || 'banmai',
            speed: String(speed),
            format: 'mp3',
          },
          body: cleanText,
        });
        if (!result.ok) throw new Error(result.error || 'FPT.AI API failed');
        data = result.data;
      } else {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            api_key: apiKey,
            voice: voice || 'banmai',
            speed: String(speed),
            format: 'mp3',
          },
          body: cleanText,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`FPT.AI Error: ${response.status} - ${errorText}`);
        }
        data = await response.json();
      }

      if (data.error) throw new Error(data.message || 'Lỗi từ FPT.AI');
      const audioUrl = data.async;

      // Cơ chế Polling: Thử tải file tối đa 10 lần, mỗi lần cách nhau 1.5s
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        try {
          if (window.electron && window.electron.ttsRequest) {
            const audioRes = await window.electron.ttsRequest(audioUrl);
            if (audioRes.ok && audioRes.data) {
              return new Blob([audioRes.data], { type: 'audio/mpeg' });
            }
          } else {
            const audioResponse = await fetch(audioUrl);
            if (audioResponse.ok) return await audioResponse.blob();
          }
        } catch (err) {
          console.warn(`Lần thử ${i+1}: File FPT chưa sẵn sàng...`);
        }
      }

      throw new Error('FPT.AI xử lý quá lâu hoặc gặp lỗi. Vui lòng thử lại.');
    } catch (error) {
      console.error('FPT.AI TTS Error:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Google Translate TTS (Tải qua Proxy để tránh lỗi)
   */
  static async getGoogleAudioBlob(text, lang = 'vi') {
    const chunks = this.splitText(text, 180);
    const blobs = [];
    
    try {
      for (const chunk of chunks) {
        const cleanText = chunk.replace(/[\n\r]+/g, ' ').trim();
        const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;

        if (window.electron && window.electron.ttsRequest) {
          const result = await window.electron.ttsRequest(targetUrl);
          if (!result.ok) throw new Error(result.error || 'Google TTS failed');
          blobs.push(new Blob([result.data], { type: 'audio/mpeg' }));
        } else {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error('Không thể tải âm thanh từ Google');
          const blob = await response.blob();
          blobs.push(blob);
        }
      }
      return new Blob(blobs, { type: 'audio/mpeg' });
    } catch (error) {
      console.error('Google TTS Fetch Error:', error);
      throw error;
    }
  }

  /**
   * Google Cloud TTS Premium (Neural2, Wavenet)
   */
  static async speakWithGoogleCloud(text, voiceName, apiKey, pitch = 0, speakingRate = 1) {
    if (!apiKey) throw new Error('Vui lòng cấu hình Google Cloud API Key.');

    // Tự động lấy languageCode từ 5 ký tự đầu của voiceName (ví dụ: vi-VN, en-US)
    const langCode = voiceName.substring(0, 5);

    try {
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      const payload = {
        input: { text: text },
        voice: { languageCode: langCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          pitch: pitch,
          speakingRate: speakingRate,
        },
      };

      let data;
      if (window.electron && window.electron.ttsRequest) {
        const result = await window.electron.ttsRequest(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!result.ok) throw new Error(result.error || 'Google Cloud API failed');
        data = result.data;
      } else {
        const response = await axios.post(url, payload);
        data = response.data;
      }

      // Trả về base64 audioContent chuyển thành Blob
      const audioContent = data.audioContent;
      const byteCharacters = atob(audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: 'audio/mp3' });
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      throw new Error(`Google Cloud Error: ${errorMsg}`);
    }
  }

  /**
   * Microsoft Edge TTS (Free & High Quality)
   */
  static async speakWithEdge(text, voice, rate = 0) {
    const ratePercent =
      rate >= 1 ? `+${Math.round((rate - 1) * 100)}%` : `-${Math.round((1 - rate) * 100)}%`;
    const voiceId = voice || 'en-US-AndrewNeural';

    // Thêm các server mới và ổn định hơn
    const servers = [
      `https://edge-tts-api.vercel.app/api/tts?text=${encodeURIComponent(text)}&voice=${voiceId}&rate=${ratePercent}`,
      `https://ms-edge-tts.vercel.app/api/tts?text=${encodeURIComponent(text)}&voice=${voiceId}&rate=${ratePercent}`,
      `https://edge-tts.onrender.com/tts?text=${encodeURIComponent(text)}&voice=${voiceId}&rate=${ratePercent}`,
      `https://api.suen.me/tts?text=${encodeURIComponent(text)}&voice=${voiceId}&rate=${ratePercent}`,
    ];

    for (const url of servers) {
      try {
        if (window.electron && window.electron.ttsRequest) {
          const result = await window.electron.ttsRequest(url);
          if (result.ok && result.data) {
            return new Blob([result.data], { type: 'audio/mpeg' });
          }
        } else {
          const response = await fetch(url);
          if (response.ok) return await response.blob();
        }
      } catch (err) {
        console.warn(`Server ${url} không phản hồi, đang thử server dự phòng...`);
      }
    }

    // DỰ PHÒNG CUỐI CÙNG: Nếu tất cả Edge hỏng, dùng Google Translate để không bị lỗi
    console.warn('Tất cả Edge servers hỏng, đang dùng Google Translate làm dự phòng...');
    const lang = voiceId.startsWith('vi') ? 'vi' : 'en';
    return await this.getGoogleAudioBlob(text, lang);
  }

  /**
   * ElevenLabs TTS (Premium Emotional Voices)
   */
  static async speakWithElevenLabs(text, voiceId, apiKey) {
    if (!apiKey) throw new Error('Vui lòng cấu hình ElevenLabs API Key.');
    const id = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Mặc định giọng Rachel

    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${id}`;
      
      if (window.electron && window.electron.ttsRequest) {
        const result = await window.electron.ttsRequest(url, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.5 }
          }),
        });
        if (!result.ok) throw new Error(result.error || 'ElevenLabs API failed');
        return new Blob([result.data], { type: 'audio/mpeg' });
      } else {
        const response = await axios.post(url, {
          text: text,
          model_id: 'eleven_multilingual_v2',
        }, {
          headers: { 'xi-api-key': apiKey },
          responseType: 'blob'
        });
        return response.data;
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      throw new Error(`ElevenLabs Error: ${errorMsg}`);
    }
  }

  static splitText(text, maxLength) {
    const chunks = [];
    let current = '';
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+/g) || [text];

    for (const sentence of sentences) {
      if ((current + sentence).length > maxLength) {
        if (current) chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }
}

export default TTSProvider;
