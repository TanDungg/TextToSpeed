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
  static async speakWithFPT(text, voice, apiKey, speed = 0) {
    if (!apiKey) throw new Error('Vui lòng cấu hình API Key FPT.AI.');

    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();

    try {
      const targetUrl = `https://api.fpt.ai/hmi/tts/v5?v=${voice || 'banmai'}&t=${Date.now()}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

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

      const data = await response.json();
      if (data.error) throw new Error(data.message || 'Lỗi từ FPT.AI');

      const audioUrl = data.async;

      // Chờ một chút để FPT.AI khởi tạo file (Polling cơ bản)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      return audioUrl;
    } catch (error) {
      console.error('FPT.AI TTS Error:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Google Translate TTS (Tải qua Proxy để tránh lỗi)
   */
  static async getGoogleAudioBlob(text, lang = 'vi') {
    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
    try {
      const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Không thể tải âm thanh từ Google');

      return await response.blob();
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
      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          input: { text: text },
          voice: { languageCode: langCode, name: voiceName },
          audioConfig: { 
            audioEncoding: 'MP3',
            pitch: pitch, // Google Cloud pitch từ -20.0 đến 20.0
            speakingRate: speakingRate // từ 0.25 đến 4.0
          },
        }
      );

      // Trả về base64 audioContent chuyển thành Blob
      const audioContent = response.data.audioContent;
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
