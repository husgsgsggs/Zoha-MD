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

const app = express();
const PORT = process.env.PORT || 3000;
let qrCodeBuffer = null;

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

        if (text === '.menu') {
            const menu = `╭═══〔 🚀 *POWER BOT* 〕═══⊷\n║ \n║ 👤 *Creators:* ZOHA & HER HUSBAND\n║ 🛠 *Status:* High-Speed Active\n║ \n╠═══〔 *COMMANDS* 〕═══⊷\n║\n║ 📥 *.img <keyword>*\n║ ↳ _Fetches 50 Ultra HD images_\n║ ↳ _1-Second Safety Delay_\n║\n║ 📜 *.menu*\n║ ↳ _Show this stylish panel_\n║\n╰══════════════════⊷\n   _Powered by Zoha Engine_`;

            if (fs.existsSync('./assets/profile.jpg')) {
                await sock.sendMessage(remoteJid, { image: fs.readFileSync('./assets/profile.jpg'), caption: menu });
            } else {
                await sock.sendMessage(remoteJid, { text: menu });
            }
        }

        if (text.startsWith('.img ')) {
            const query = text.replace('.img ', '');
            await sock.sendMessage(remoteJid, { text: `💠 *Processing:* Fetching 50 High-Res images of "${query}"...` });

            try {
                const res = await axios.get(`https://api.fdci.se/sosmed/rep.php?gambar=${query}`);
                let images = res.data.result.slice(0, 50);

                for (let i = 0; i < images.length; i++) {
                    try {
                        let url = images[i];
                        if (url.includes('pinimg.com')) {
                            url = url.replace(/\/(236x|474x|736x)\//g, '/originals/');
                        }
                        
                        await sock.sendMessage(remoteJid, { 
                            image: { url }, 
                            caption: `✨ *Result:* ${i + 1}/50` 
                        });
                        
                        await delay(1000); // 1-second delay is crucial for heavy sending
                    } catch (itemError) {
                        console.log(`Failed to send image ${i}:`, itemError.message);
                        // Continue to next image even if one fails
                        continue; 
                    }
                }
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: "❌ *Error:* The image server is busy. Try again." });
            }
        }
    });
}

// Global error handler to prevent the entire process from dying
process.on('uncaughtException', (err) => {
    console.error('Caught exception: ', err);
    startBot(); 
});

startBot();
        
