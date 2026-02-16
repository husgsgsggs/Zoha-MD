global.crypto = require('crypto');
const { 
    default: makeWASocket, useMultiFileAuthState, delay, 
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const axios = require("axios");
const express = require("express"); // Added Express
const QRCode = require("qrcode"); // Added QRCode
const { googleImg } = require('google-img-scrap');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini AI Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});



const app = express();
const PORT = process.env.PORT || 3000;
let qrCodeBuffer = null;
// 1. Add this variable near your other 'let' variables (like qrCodeBuffer)
let activeTask = {};

// Simple web endpoint to show the QR code
app.get("/", (req, res) => {
    if (qrCodeBuffer) {
        res.send(`
            <html>
                <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                    <h1>Zoha Power Bot - Scan QR</h1>
                    <img src="${qrCodeBuffer}" width="300"/>
                    <p>Scan this with your WhatsApp to connect.</p>
                    <script>setTimeout(() => { location.reload(); }, 20000);</script>
                </body>
            </html>
        `);
    } else {
        res.send("<h2>QR Code not ready or already connected! Check console.</h2>");
    }
});

app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: true, // Keep this for backup
        logger: pino({ level: "silent" }),
        browser: ["Zoha-Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Generate QR image for the website if a new QR is issued
        if (qr) {
            qrCodeBuffer = await QRCode.toDataURL(qr);
            console.log("📌 New QR Code generated. View it at your Sevalla URL.");
        }

        if (connection === 'close') {
            qrCodeBuffer = null; // Clear QR on close
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            qrCodeBuffer = null; // Clear QR once connected
            console.log('✅ Zoha Power Bot Online!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const remoteJid = msg.key.remoteJid;
        const from = remoteJid;
        const body = text.trim();
        const args = body.split(' ').slice(1);
        const command = body.split(' ')[0].toLowerCase();

        if (command === '.menu') {
            const menu = `╭═══〔 🚀 *POWER BOT* 〕═══⊷\n║ \n║ 👤 *Creators:* ZOHA & HER HUSBAND\n║ 🛠 *Status:* High-Speed Active\n║ \n╠═══〔 *COMMANDS* 〕═══⊷\n║\n║ 📥 *.img <keyword>*\n║ ↳ _Fetches 50 Ultra HD images_\n ║ 🤖 *.ai <question>*\n
║ ↳ _Chat with Google Gemini AI_\n
║ ↳ _1-Second Safety Delay_\n║\n║ 📜 *.menu*\n║ ↳ _Show this stylish panel_\n║\n╰══════════════════⊷\n   _Powered by Zoha Engine_`;

            if (fs.existsSync('./assets/profile.jpg')) {
                await sock.sendMessage(remoteJid, { image: fs.readFileSync('./assets/profile.jpg'), caption: menu });
            } else {
                await sock.sendMessage(remoteJid, { text: menu });
            }
        }

        

                // COMMAND: .ai or .gemini
        if (command === '.ai') {
  const prompt = args.join(' ');
  if (!prompt) return sock.sendMessage(from, { text: 'Ask something.' });

  await sock.sendMessage(from, { text: '🤖 Thinking...' });

  try {
    const result = await aiModel.generateContent(prompt);
    const reply = result.response.text();

    await sock.sendMessage(from, { text: reply });

  } catch (error) {
    console.error(error);
    await sock.sendMessage(from, {
      text: '⚠️ AI failed. Check API key.'
    });
  }
      }
            
        
// ... (keep your existing express and startBot code)

        
        if (command === '.img') {
  const query = args.join(' ');
  if (!query) return sock.sendMessage(from, { text: 'Send search term.' });

  await sock.sendMessage(from, { text: '🖼️ Fetching images...' });

  try {
    const res = await axios.get(
      `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query + " pfp dp square")}&ijn=0&api_key=${process.env.SERPAPI_KEY}`
    );

    const images = res.data.images_results
      .slice(0, 50)
      .map(img => img.original);

    for (const img of images) {
      await sock.sendMessage(from, { image: { url: img } });
      await new Promise(r => setTimeout(r, 700));
    }

  } catch (err) {
    console.error(err);
    await sock.sendMessage(from, {
      text: '⚠️ Image fetch failed.'
    });
  }
        }



        }); // <--- ADD THIS BRACKET AND PARENTHESIS HERE

} // This one closes the async function startBot()

// Global error handler to prevent the entire process from dying
process.on('uncaughtException', (err) => {
    console.error('Caught exception: ', err);
    startBot(); 
});

startBot();
        
