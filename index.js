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
const yts = require("yt-search");
const { exec } = require("child_process");
const PImage = require("pureimage");
const path = require("path");
const os = require("os");
const { googleImg } = require('google-img-scrap');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini AI Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});
function getMessageText(msg) {
  const m = msg?.message;
  if (!m) return "";

  // unwrap common wrappers used a lot in groups
  const inner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.viewOnceMessageV2Extension?.message ||
    m.documentWithCaptionMessage?.message ||
    m;

  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    ""
  ).trim();
      }

// ===== FINAL BOSS GLOBAL STORAGE =====

const SETTINGS = {
  autoReact: true,
  emoji: "🔥"
};

const USERS = {};
const GROUPS = {};
const LUDO = {};
const WORDCHAIN = {};

const SAFE_CELLS = [1,9,14,22,27,35,40,48];
const WIN_POS = 56;

function nextTurn(g){
  g.turn = (g.turn + 1) % g.players.length;
}

function getUser(id){
  if(!USERS[id]) USERS[id] = { xp:0, coins:100 };
  return USERS[id];
}


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


function downloadWithYtDlp(url, outFile, formatArgs) {
  return new Promise((resolve, reject) => {
    const cmd = `yt-dlp ${formatArgs} -o "${outFile}" "${url}"`;

    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve(outFile);
    });
  });
}



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
        const text = getMessageText(msg);
        const remoteJid = msg.key.remoteJid;
        const from = remoteJid;
        const body = text.trim();
        const args = body.split(' ').slice(1);
        const command = body.split(' ')[0].toLowerCase();
        const isGroup = from.endsWith("@g.us");
        const sender = msg.key.participant || from;
        const user = getUser(sender);

// 🔥 Auto reaction
        if (SETTINGS.autoReact) {           
            await sock.sendMessage(from, {
    react: { text: SETTINGS.emoji, key: msg.key }
  });
}
        if (command === ".alive") {
  return sock.sendMessage(from,{
    text:`👑 Zoha Power Bot ONLINE
⏱ Uptime: ${Math.floor(process.uptime())} sec`
  });
}

        if (command === ".ping") {
  const start = Date.now();
  await sock.sendMessage(from,{text:"🏓 Testing..."});
  return sock.sendMessage(from,{
    text:`🏓 ${Date.now()-start} ms`
  });
}
        if (command === ".wc" && args[0] === "start") {
  WORDCHAIN[from] = {
    host: sender,
    level: args[1] || "easy",
    players:[sender],
    turn:0,
    last:"",
    used:[]
  };

  return sock.sendMessage(from,{text:"🎯 Word Chain started!"});
        }

        if (command === ".wc" && args[0] === "join") {
  const g = WORDCHAIN[from];
  if(!g) return;

  if(!g.players.includes(sender))
    g.players.push(sender);

  return sock.sendMessage(from,{text:"Joined."});
        }

        if (command === ".wc" && args[0] === "word") {
  const g = WORDCHAIN[from];
  if(!g) return;

  const current = g.players[g.turn];
  if(sender !== current) return;

  const w = args[1]?.toLowerCase();
  if(!w) return;

  if(g.used.includes(w))
    return sock.sendMessage(from,{text:"Used word."});

  if(g.last && w[0] !== g.last.slice(-1))
    return sock.sendMessage(from,{text:"Wrong letter."});

  g.used.push(w);
  g.last = w;
  nextTurn(g);

  return sock.sendMessage(from,{
    text:`Accepted: ${w}\nNext: ${w.slice(-1)}`
  });
                     }
        if (command === ".ludo" && args[0] === "start") {
  LUDO[from] = {
    players:[sender],
    turn:0,
    tokens:{ [sender]:[0,0,0,0] },
    captured:{ [sender]:false }
  };

  return sock.sendMessage(from,{text:"🎲 Ludo started!"});
            }
        if (command === ".ludo" && args[0] === "join") {
  const g = LUDO[from];
  if(!g) return;

  if(!g.players.includes(sender)){
    g.players.push(sender);
    g.tokens[sender]=[0,0,0,0];
    g.captured[sender]=false;
  }

  return sock.sendMessage(from,{text:"Joined Ludo."});
            }
        if (command === ".ludo" && args[0] === "roll") {
  const g = LUDO[from];
  if(!g) return;

  const current = g.players[g.turn];
  if(sender !== current) return;

  const dice = Math.floor(Math.random()*6)+1;
  g.dice = dice;

  return sock.sendMessage(from,{text:`🎲 ${dice}`});
        }
        
        if (command === ".ludo" && args[0] === "move") {
  const g = LUDO[from];
  if(!g) return;

  const i = parseInt(args[1])-1;
  const dice = g.dice;
  if(isNaN(i) || !dice) return;

  let pos = g.tokens[sender][i];

  if(pos===0 && dice!==6)
    return sock.sendMessage(from,{text:"Need 6 to enter."});

  pos = pos===0 ? 1 : pos + dice;

  if(pos>=WIN_POS){
    if(!g.captured[sender])
      return sock.sendMessage(from,{text:"Must capture first."});
    pos = WIN_POS;
  }

  for(const p of g.players){
    if(p===sender) continue;
    g.tokens[p].forEach((ep,j)=>{
      if(ep===pos && !SAFE_CELLS.includes(pos)){
        g.tokens[p][j]=0;
        g.captured[sender]=true;
      }
    });
  }

  g.tokens[sender][i]=pos;

  if(g.tokens[sender].every(t=>t===WIN_POS)){
    delete LUDO[from];
    return sock.sendMessage(from,{text:`🏆 ${sender.split("@")[0]} wins!`});
  }

  if(dice!==6) nextTurn(g);
  g.dice=null;

  return sock.sendMessage(from,{text:"Move done."});
                          }
        if (command === ".ludo" && args[0] === "board") {
  const g = LUDO[from];
  if(!g) return;

  const img = PImage.make(500,500);
  const ctx = img.getContext("2d");

  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,500,500);

  let y=20;
  for(const p of g.players){
    ctx.fillStyle="#000";
    ctx.fillText(p.split("@")[0]+": "+g.tokens[p].join(","),20,y);
    y+=20;
  }

  const file = path.join(os.tmpdir(),"ludo.png");
  await PImage.encodePNGToStream(img, fs.createWriteStream(file));

  await sock.sendMessage(from,{image:fs.readFileSync(file)});
      }
        if (command === ".help") {
  return sock.sendMessage(from,{
    text:`👑 BOT HELP

🎯 WORD CHAIN
.wc start
.wc join
.wc word <word>

🎲 LUDO
.ludo start
.ludo join
.ludo roll
.ludo move <1-4>
.ludo board

⚙️ SYSTEM
.alive
.ping
.yt <search>
.song <name>`
  });
      }
        if (command === ".video") {
  const q = args.join(" ");
  if (!q) return;

  await sock.sendMessage(from,{text:"⬇️ Downloading video..."});

  let url = q;

  if (!q.startsWith("http")) {
    const r = await yts(q);
    url = r.videos[0]?.url;
    if (!url) return sock.sendMessage(from,{text:"Not found"});
  }

  const file = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);

  try {
    await downloadWithYtDlp(
      url,
      file,
      '-f "bv*[height<=720]+ba/b[height<=720]" --merge-output-format mp4 --max-filesize 50M'
    );

    await sock.sendMessage(from,{
      video:{ url:file },
      caption:"🎥 Video downloaded"
    });

  } catch {
    sock.sendMessage(from,{text:"Download failed"});
  }
        }
        if (command === ".audio") {
  const q = args.join(" ");
  if (!q) return;

  await sock.sendMessage(from,{text:"🎵 Downloading audio..."});

  let url = q;

  if (!q.startsWith("http")) {
    const r = await yts(q);
    url = r.videos[0]?.url;
    if (!url) return;
  }

  const file = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);

  try {
    await downloadWithYtDlp(
      url,
      file,
      '-x --audio-format mp3 --max-filesize 50M'
    );

    await sock.sendMessage(from,{
      document:{ url:file },
      mimetype:"audio/mpeg",
      fileName:"song.mp3"
    });

  } catch {
    sock.sendMessage(from,{text:"Audio download failed"});
  }
        }
        if (command === ".playlist") {
  const url = args[0];
  if (!url) return;

  const file = path.join(os.tmpdir(), `pl_${Date.now()}.mp4`);

  await sock.sendMessage(from,{text:"⬇️ Downloading playlist item..."});

  try {
    await downloadWithYtDlp(
      url,
      file,
      '--playlist-items 1 -f "b[height<=720]" --merge-output-format mp4'
    );

    await sock.sendMessage(from,{ video:{ url:file } });

  } catch {
    sock.sendMessage(from,{text:"Failed"});
  }
        }
        if (command === ".song") {
  const q = args.join(" ");
  if (!q) return;

  const r = await yts(q);
  const url = r.videos[0]?.url;
  if (!url) return;

  const file = path.join(os.tmpdir(), `song_${Date.now()}.mp3`);

  await sock.sendMessage(from,{text:"🎵 Downloading..."});

  await downloadWithYtDlp(
    url,
    file,
    '-x --audio-format mp3 --max-filesize 50M'
  );

  await sock.sendMessage(from,{
    document:{ url:file },
    mimetype:"audio/mpeg",
    fileName:"song.mp3"
  });
        }
        
        if (command === ".compress") {
  const url = args[0];
  if (!url) return;

  const raw = path.join(os.tmpdir(), "raw.mp4");
  const out = path.join(os.tmpdir(), "small.mp4");

  await downloadWithYtDlp(url, raw, '-f "b[height<=720]"');

  exec(`ffmpeg -i "${raw}" -vcodec libx264 -crf 28 "${out}"`,
  async () => {
    await sock.sendMessage(from,{ video:{ url:out } });
  });
        }
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
        
