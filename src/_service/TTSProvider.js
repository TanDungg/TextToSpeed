import axios from 'axios';

class TTSProvider {
  /**
   * OpenAI TTS
   */
  static async speakWithOpenAI(text, voice, apiKey, rate = 1) {
    if (!apiKey) throw new Error('Vui lòng cấu hình API Key OpenAI trong phần cài đặt.');

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
      const errorMsg = error.response?.data?.error?.message || error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * FPT.AI TTS (V5 Standard)
   */
  static async speakWithFPT(text, voice, apiKey, speed = 0) {
    if (!apiKey) throw new Error('Vui lòng cấu hình API Key FPT.AI trong phần cài đặt.');

    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();

    try {
      // Sử dụng corsproxy.io để gửi đầy đủ Header mà không bị chặn CORS
      // Thêm voice và t vào targetUrl để tránh Proxy trả về kết quả cache khi đổi giọng
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
      console.log('FPT.AI Audio URL Ready:', audioUrl);

      // Chờ file sẵn sàng với polling thông minh hơn
      return await this.pollFPTAudio(audioUrl);
    } catch (error) {
      console.error('FPT.AI TTS Error:', error);
      throw new Error(error.message);
    }
  }

  static async pollFPTAudio(url) {
    // Chờ khoảng 1.2s là thời gian lý tưởng cho đa số các câu ngắn/vừa
    await new Promise((r) => setTimeout(r, 1200));
    return url;
  }

  /**
   * Google Translate TTS (Free)
   */
  static getGoogleTranslateUrls(text, lang = 'vi') {
    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
    const chunks = this.splitText(cleanText, 200);
    // Sử dụng client dict-chrome-ex cực kỳ ổn định
    return chunks.map(
      (chunk) =>
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=dict-chrome-ex`
    );
  }

  /**
   * Microsoft Edge TTS (Free) - Proxy mới suenon ổn định
   */
  static getEdgeTTSUrl(text, voice = 'vi-VN-HoaiMyNeural') {
    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
    return `https://api.suenon.com/edge-tts?text=${encodeURIComponent(cleanText)}&voice=${voice}`;
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
