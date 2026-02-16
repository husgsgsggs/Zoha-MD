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

        


        
// ... (keep your existing express and startBot code)

                if (text.startsWith('.img ')) {
            const args = text.slice(5).split(' ');
            // If the last argument is a number, use it as the limit; otherwise default to 50
            const lastArg = args[args.length - 1];
            let limit = parseInt(lastArg);
            let query;

            if (!isNaN(limit)) {
                limit = Math.min(limit, 50); // Hard cap at 50 to prevent crashes
                query = args.slice(0, -1).join(' ');
            } else {
                limit = 50;
                query = args.join(' ');
            }

            await sock.sendMessage(remoteJid, { text: `💠 *Processing:* Fetching ${limit} High-Res images of "${query}"...` });

            try {
                // Using axios for a more stable connection on hosted environments
                const res = await axios.get(`https://api.fdci.se/sosmed/rep.php?gambar=${encodeURIComponent(query)}`);
                const images = res.data.result;

                if (!images || images.length === 0) {
                    return await sock.sendMessage(remoteJid, { text: "❌ *Error:* No images found." });
                }

                const actualCount = Math.min(images.length, limit);

                for (let i = 0; i < actualCount; i++) {
                    try {
                        let url = images[i];

                        // Optimize Pinterest quality to original size
                        if (url.includes('pinimg.com')) {
                            url = url.replace(/\/(236x|474x|736x)\//g, '/originals/');
                        }
                        
                        await sock.sendMessage(remoteJid, { 
                            image: { url: url }, 
                            caption: `✨ *Result:* ${i + 1}/${actualCount}\n🔍 *Query:* ${query}` 
                        });
                        
                        // 1-second safety delay to protect your WhatsApp account
                        await delay(1000);
                    } catch (itemError) {
                        console.log(`Failed to send image ${i}:`, itemError.message);
                        continue; 
                    }
                }
            } catch (e) {
                console.error("Search Error: ", e.message);
                await sock.sendMessage(remoteJid, { text: "❌ *Error:* The image server is busy or blocked. Please try again later." });
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
        
