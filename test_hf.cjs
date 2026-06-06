const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const readline = require('readline');

async function test() {
  try {
    const spaceUrl = 'https://kotchu-real-esrgan.hf.space';

    // Create a dummy 1x1 transparent PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const imagePath = path.join(__dirname, 'test_temp.png');
    fs.writeFileSync(imagePath, Buffer.from(pngBase64, 'base64'));
    console.log('Created dummy image at:', imagePath);

    // 1. Upload the image file
    console.log('1. Uploading file...');
    const form = new FormData();
    form.append('files', fs.createReadStream(imagePath));

    const uploadRes = await axios.post(`${spaceUrl}/gradio_api/upload`, form, {
      headers: form.getHeaders(),
    });
    const uploadedPath = uploadRes.data[0];
    console.log('Uploaded server path:', uploadedPath);

    // 2. Call the predict endpoint
    console.log('2. Calling predict endpoint...');
    const callRes = await axios.post(
      `${spaceUrl}/gradio_api/call/predict`,
      {
        data: [
          { path: uploadedPath, meta: { _type: 'gradio.FileData' } },
          'realesrgan-x4plus', // Model
          2, // Scaling factor (2)
          false, // Use TTA
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const eventId = callRes.data.event_id;
    console.log('Event ID:', eventId);

    // 3. Poll / read the data stream
    console.log('3. Listening to status/data stream...');
    const streamRes = await axios.get(`${spaceUrl}/gradio_api/call/predict/${eventId}`, {
      responseType: 'stream',
    });

    const rl = readline.createInterface({
      input: streamRes.data,
      terminal: false,
    });

    let currentEvent = '';
    rl.on('line', (line) => {
      console.log('LINE:', line);
      if (line.startsWith('event:')) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim();
        if (dataStr && dataStr !== 'null') {
          try {
            const dataObj = JSON.parse(dataStr);
            console.log(`Parsed event [${currentEvent}]:`, JSON.stringify(dataObj, null, 2));
          } catch (e) {
            console.log(`Failed to parse data: ${dataStr}`);
          }
        }
      }
    });

    rl.on('close', () => {
      console.log('ReadLine stream closed.');
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {}
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
