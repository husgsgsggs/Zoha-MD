const crypto = require('crypto');
const { 
    default: makeWASocket, useMultiFileAuthState, delay, 
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const axios = require("axios");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- PAIRING LOGIC (Using Env Variable) ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.BOT_NUMBER; 
        if (phoneNumber) {
            console.log(`\n⏳ Requesting Pairing Code for: ${phoneNumber}...`);
            await delay(5000); 
            const code = await sock.requestPairingCode(phoneNumber.trim());
            console.log(`\n💎 YOUR PAIRING CODE: ${code}\n`);
        } else {
            console.log("\n❌ ERROR: 'BOT_NUMBER' variable not found in Sevalla settings!");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    // --- AUTO-RESTART LOGIC ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot(); // Auto-restart the function
        } else if (connection === 'open') {
            console.log('✅ Zoha Power Bot Online & Stable!');
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
        
