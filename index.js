const { 
    default: makeWASocket, useMultiFileAuthState, delay, 
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const readline = require("readline");
const axios = require("axios");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

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

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question("Enter WhatsApp number (e.g., 923001234567): ");
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n💎 YOUR PAIRING CODE: ${code}\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Zoha Power Bot Online!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const remoteJid = msg.key.remoteJid;

        // --- COMMAND: .menu ---
        if (text === '.menu') {
            const menu = `╭═══〔 🚀 *POWER BOT* 〕═══⊷
║ 
║ 👤 *Creators:* ZOHA & HER HUSBAND
║ 🛠 *Status:* High-Speed Active
║ 
╠═══〔 *COMMANDS* 〕═══⊷
║
║ 📥 *.img <keyword>*
║ ↳ _Fetches 50 Ultra HD images_
║ ↳ _1-Second Safety Delay_
║
║ 📜 *.menu*
║ ↳ _Show this stylish panel_
║
╰══════════════════⊷
   _Powered by Zoha Engine_`;

            if (fs.existsSync('./assets/profile.jpg')) {
                await sock.sendMessage(remoteJid, { image: fs.readFileSync('./assets/profile.jpg'), caption: menu });
            } else {
                await sock.sendMessage(remoteJid, { text: menu });
            }
        }

        // --- COMMAND: .img ---
        if (text.startsWith('.img ')) {
            const query = text.replace('.img ', '');
            await sock.sendMessage(remoteJid, { text: `💠 *Processing:* Searching 50 HD images of "${query}"...` });

            try {
                const res = await axios.get(`https://api.fdci.se/sosmed/rep.php?gambar=${query}`);
                let images = res.data.result.slice(0, 50);

                for (let i = 0; i < images.length; i++) {
                    let url = images[i];
                    // High-Res Transformation for Pinterest
                    if (url.includes('pinimg.com')) {
                        url = url.replace(/\/(236x|474x|736x)\//g, '/originals/');
                    }

                    await sock.sendMessage(remoteJid, { image: { url }, caption: `✨ *Result:* ${i + 1}/50` });
                    await delay(1000); 
                }
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: "❌ *Error:* Failed to fetch images." });
            }
        }
    });
}

startBot();
