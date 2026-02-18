if (typeof File === "undefined") {
global.File = class File {};
}
global.crypto = require('crypto');
const { 
    default: makeWASocket, useMultiFileAuthState, delay, 
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const Jimp = require("jimp");
const axios = require("axios");
const express = require("express"); // Added Express
const QRCode = require("qrcode"); // Added QRCode
const yts = require("yt-search");
const { exec, execFile } = require("child_process");
const PImage = require("pureimage");
const path = require("path");
const os = require("os");
const { GoogleGenerativeAI } = require("@google/generative-ai");
process.on("uncaughtException", err => {
  console.error("Uncaught:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled:", err);
});

// Gemini AI Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});
function getMessageText(msg) {
  const m = msg?.message;
  if (!m) return "";

  const inner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.viewOnceMessageV2Extension?.message ||
    m.editedMessage?.message ||
    m.documentWithCaptionMessage?.message ||
    m;

  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    inner.buttonsResponseMessage?.selectedButtonId ||
    inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
    inner.templateButtonReplyMessage?.selectedId ||
    ""
  ).trim();
      }
      
const ACTIVE_DOWNLOAD = {};

async function withDownloadLock(chatId, fn) {
  if (ACTIVE_DOWNLOAD[chatId]) throw new Error("⏳ A download is already running here. Wait.");
  ACTIVE_DOWNLOAD[chatId] = true;
  try { return await fn(); }
  finally { ACTIVE_DOWNLOAD[chatId] = false; }
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

function downloadWithYtDlp(url, outFile, argsArr) {
  return new Promise((resolve, reject) => {
    const args = [...argsArr, "-o", outFile, url];
    execFile("yt-dlp", args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
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

    sock.ev.on("messages.upsert", async ({ messages }) => {

  try {
  const msg = messages[0];
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith("@g.us");

  // ✅ Identify sender correctly (works in groups + private)
  const sender = (isGroup ? (msg.key.participant || msg.participant) : from) || from;

  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    "";

  if (!body) return;

  const args = body.trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  console.log("FROM:", from, "ISGROUP:", isGroup, "BODY:", body);

  
  // ✅ your commands below...

// 🔥 Auto reaction
        const isFromMe = msg.key.fromMe === true;

if (!isFromMe && SETTINGS.autoReact && body) {
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

        if (command === ".react") {
  const sub = (args[0] || "").toLowerCase();
  if (sub === "on") SETTINGS.autoReact = true;
  else if (sub === "off") SETTINGS.autoReact = false;
  else if (sub === "emoji") SETTINGS.emoji = args[1] || "🔥";

  return sock.sendMessage(from, {
    text: `✅ AutoReact: ${SETTINGS.autoReact ? "ON" : "OFF"}\n😀 Emoji: ${SETTINGS.emoji}\n\nUse:\n.react on\n.react off\n.react emoji 😎`
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
        
        // ===== WORD CHAIN EXTRA COMMANDS =====

// Begin game
if (command === ".wc" && args[0] === "begin") {
  const game = WORDCHAIN[from];
  if (!game) return sock.sendMessage(from, { text: "❌ No game." });
  if (game.players.length < 2)
    return sock.sendMessage(from, { text: "Need at least 2 players." });

  game.started = true;
  game.turn = 0;
  

  return sock.sendMessage(from, {
    text: `🎯 Word Chain started!\nFirst turn: @${game.players[0].split('@')[0]}`,
    mentions: game.players
  });
}


// Show status
if (command === ".wc" && args[0] === "status") {
  const game = WORDCHAIN[from];
  if (!game) return sock.sendMessage(from, { text: "❌ No game." });

  return sock.sendMessage(from, {
    text:
      `🎯 Word Chain Status\n` +
      `Players: ${game.players.length}\n` +
      `Started: ${game.started ? "Yes" : "No"}\n` +
      `Turn: ${game.players[game.turn]?.split('@')[0] || "-"}\n` +
      `Last Word: ${game.last || "None"}`
  });
}


// End game
if (command === ".wc" && args[0] === "end") {
  if (!WORDCHAIN[from]) return sock.sendMessage(from, { text: "❌ No game." });

  delete WORDCHAIN[from];

  return sock.sendMessage(from, { text: "🏁 Word Chain game ended." });
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
        if (command === ".ludo" && (args[0] === "start" || args[0] === "begin")) {
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
        if (command === ".ludo" && (args[0] === "roll" || args[0] === "dice")) {
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
  const game = LUDO[from];
  if (!game) return;

  const file = path.join(os.tmpdir(), "ludo.png");

  const img = new Jimp(400,400,0xffffffff);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

  Object.entries(game.tokens).forEach(([p, toks], i) => {
    const name = p.split("@")[0];
    img.print(font, 10, 10 + i*40, `${i+1}. ${name}`);
    img.print(font, 30, 28 + i*40, `Tokens: ${toks.join(", ")}`);
  });

  await img.writeAsync(file);

  // Send image
  await sock.sendMessage(from, { image: fs.readFileSync(file) });

  // 👇 ADD THIS LINE RIGHT HERE
  try { fs.unlinkSync(file); } catch {}
}

// ===== LUDO EXTRA COMMANDS =====

// Show status
if (command === ".ludo" && args[0] === "status") {
  const game = LUDO[from];
  if (!game) return sock.sendMessage(from, { text: "❌ No game." });

  const playerList = game.players
    .map((p, i) => `${i + 1}. @${p.split('@')[0]}`)
    .join("\n");

  return sock.sendMessage(from, {
    text:
      `🎲 Ludo Status\n\n` +
      `Players:\n${playerList}\n\n` +
      `Current turn: @${game.players[game.turn]?.split('@')[0] || "-"}`,
    mentions: game.players
  });
}


// End game
if (command === ".ludo" && args[0] === "end") {
  if (!LUDO[from]) return sock.sendMessage(from, { text: "❌ No game." });

  delete LUDO[from];

  return sock.sendMessage(from, { text: "🏁 Ludo game ended." });
}


        if (command === ".help") {
  const help = `╭═══〔 📜 *POWER BOT HELP* 〕═══⊷
║
╠═══〔 🎯 WORD CHAIN (WC) 〕═══⊷
║ ✅ *Commands*
║ 🎯 *.wc start <easy|medium|hard|insane>*
║ ↳ Create game (default: easy)
║ 🎯 *.wc join*
║ ↳ Join players list
║ 🎯 *.wc begin*
║ ↳ Host starts game + timer begins
║ 🎯 *.wc word <word>*
║ ↳ Play your word on your turn
║ 🎯 *.wc status*
║ ↳ Show players, turn, last word
║ 🎯 *.wc end*
║ ↳ Host ends game
║
║ 📌 *Rules*
║ • Turn-based game in group/DM
║ • First word can be anything (valid word)
║ • Next word must start with the *last letter* of previous word
║ • *No repeats* (same word cannot be used again)
║ • If you send wrong starting letter → rejected
║ • If you exceed time limit → eliminated ❌
║ • Last remaining player wins 🏆
║
║ ⏱ *Levels & Time*
║ • easy:   min 3 letters | 20s per turn
║ • medium: min 4 letters | 15s per turn
║ • hard:   min 5 letters | 12s per turn
║ • insane: min 6 letters | 10s per turn
║
╠═══〔 🎲 LUDO (FULL) 〕═══⊷
║ ✅ *Commands*
║ 🎲 *.ludo start*
║ ↳ Create a ludo game
║ 🎲 *.ludo join*
║ ↳ Join game (max 4 players)
║ 🎲 *.ludo roll*
║ ↳ Roll dice (only current player)
║ 🎲 *.ludo move <1-4>*
║ ↳ Move token number
║ 🖼 *.ludo board*
║ ↳ Show board image/status
║ 🎲 *.ludo status*
║ ↳ Show token positions
║ 🎲 *.ludo end*
║ ↳ End game
║
║ 📌 *Rules*
║ • Each player has *4 tokens*
║ • Need *6* to bring a token out of home
║ • Rolling *6 = extra turn*
║ • Landing on enemy token *captures* it → sends it back home
║ • *Safe cells* cannot be captured
║ • Winner is first to get *all 4 tokens* to finish 🏆
║ ⭐ *Special Rule:* You MUST capture at least *one* enemy token
║   before any of your tokens can finish (enter final home).
║
╠═══〔 ⚙️ SYSTEM 〕═══⊷
║ ❤️ *.alive*  ↳ Bot status
║ 🏓 *.ping*   ↳ Speed test
║ 🔥 *.react on/off/emoji* ↳ Auto reactions
║ 📜 *.menu*   ↳ Full command panel
║
╰════════════════════⊷
   👑 _Powered by Zoha Engine_`;

  // same style as menu: send with image if exists
  if (fs.existsSync("./assets/profile.jpg")) {
    await sock.sendMessage(from, {
      image: fs.readFileSync("./assets/profile.jpg"),
      caption: help
    });
  } else {
    await sock.sendMessage(from, { text: help });
  }
}
        
        if (command === ".video") {
  return withDownloadLock(from, async () => {

    const q = args.join(" ");
    if (!q) return;

    await sock.sendMessage(from, { text: "⬇️ Downloading video..." });

    let url = q;
    if (!q.startsWith("http")) {
      const r = await yts(q);
      url = r.videos[0]?.url;
      if (!url) return sock.sendMessage(from, { text: "Not found" });
    }

    const file = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);

    try {
      await downloadWithYtDlp(url, file, [
        "-f", "bv*[height<=720]+ba/b[height<=720]",
        "--merge-output-format", "mp4",
        "--max-filesize", "50M"
      ]);

      const buff = fs.readFileSync(file);

      await sock.sendMessage(from, {
        video: buff,
        caption: "🎥 Video downloaded"
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, {
        text: "Download failed: " + (err.message || err)
      });

    } finally {
      try { fs.unlinkSync(file); } catch {}
    }

  }).catch(e =>
    sock.sendMessage(from, { text: e.message })
  );
        }
        if (command === ".song") {
  const q = args.join(" ");
  if (!q) return sock.sendMessage(from, { text: "Use: .song <name>" });

  await sock.sendMessage(from, { text: "🎵 Downloading..." });

  try {
    const r = await yts(q);
    const url = r.videos?.[0]?.url;
    if (!url) return sock.sendMessage(from, { text: "Not found." });

    const file = path.join(os.tmpdir(), `song_${Date.now()}.mp3`);

    try {
      await downloadWithYtDlp(url, file, [
        "-x",
        "--audio-format", "mp3",
        "--max-filesize", "50M"
      ]);
     const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
if (size === 0) throw new Error("Downloaded file is empty (yt-dlp extraction failed)");

      const buff = fs.readFileSync(file);

      await sock.sendMessage(from, {
        document: buff,
        mimetype: "audio/mpeg",
        fileName: "song.mp3"
      });

    } finally {
      // cleanup temp file
      try { fs.unlinkSync(file); } catch {}
    }

  } catch (e) {
    console.error(e);
    await sock.sendMessage(from, { text: "Audio download failed: " + (e.message || e) });
  }
}
        
       if (command === ".compress") {
  const url = args[0];
  if (!url) return sock.sendMessage(from, { text: "Use: .compress <video_url>" });

  await sock.sendMessage(from, { text: "🧪 Compressing video..." });

  const raw = path.join(os.tmpdir(), `raw_${Date.now()}.mp4`);
  const out = path.join(os.tmpdir(), `small_${Date.now()}.mp4`);

  try {

    // 1) Download source video
    await downloadWithYtDlp(url, raw, [
      "-f", "b[height<=720]",
      "--max-filesize", "70M"
    ]);

    // 2) Compress using ffmpeg
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -i "${raw}" -vcodec libx264 -crf 28 "${out}"`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    const size = fs.existsSync(out) ? fs.statSync(out).size : 0;
if (size === 0) throw new Error("Compression failed (empty file)");

    // 3) Send as Buffer (most reliable)
    const buff = fs.readFileSync(out);

    await sock.sendMessage(from, {
      video: buff,
      caption: "🧪 Compressed video"
    });

  } catch (e) {
    console.error(e);
    await sock.sendMessage(from, { text: "Compression failed: " + (e.message || e) });

  } finally {
    // 4) Clean up temp files
    try { fs.unlinkSync(raw); } catch {}
    try { fs.unlinkSync(out); } catch {}
  }
}
        if (command === '.menu') {

const menu = `╭═══〔 🚀 *POWER BOT — FINAL BOSS* 〕═══⊷
║ 
║ 👤 *Creators:* ZOHA & HER HUSBAND
║ ⚡ *Engine:* Zoha Ultimate Core
║ 🛠 *Status:* High-Speed Active
║ 
╠═══〔 🤖 AI & IMAGES 〕═══⊷
║ 📥 *.img <keyword>*
║ ↳ Fetch 50 Ultra HD images
║
║ 🤖 *.ai <question>*
║ ↳ Chat with Gemini AI
║
╠═══〔 🎬 MEDIA GOD 〕═══⊷
║ 🎥 *.video <name/url>*
║ ↳ Download video (multi-site)
║
║ 🎧 *.song <name>*
║ ↳ Music search + download
║
║ 🧪 *.compress <url>*
║ ↳ Reduce video size
║
╠═══〔 🎮 GAMES 〕═══⊷
║ 🎯 *.wc start/join/begin*
║ ↳ Word Chain Game
║
║ 🎲 *.ludo start/join*
║ ↳ Real Ludo Multiplayer
║
║ 🎲 *.ludo roll / move*
║ ↳ Play turn
║
║ 🖼 *.ludo board*
║ ↳ Show board image
║
╠═══〔 ⚙️ SYSTEM 〕═══⊷
║ ❤️ *.alive*
║ ↳ Bot status
║
║ 🏓 *.ping*
║ ↳ Speed test
║
║ 🔥 *.react on/off/emoji*
║ ↳ Auto reactions
║
║ 📜 *.help*
║ ↳ Full rules & guide
║
╰════════════════════⊷
   👑 _Powered by Zoha Engine_`;

    if (fs.existsSync('./assets/profile.jpg')) {
        await sock.sendMessage(from, {
            image: fs.readFileSync('./assets/profile.jpg'),
            caption: menu
        });
    } else {
        await sock.sendMessage(from, { text: menu });
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
     
  } catch (err) {
    console.error("❌ Message handler error:", err);
  }

   }



        }); // <--- ADD THIS BRACKET AND PARENTHESIS HERE

} // This one closes the async function startBot()

// Global error handler to prevent the entire process from dying


startBot();
        
