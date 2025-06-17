const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');
const vm = require('vm');
const qs = require('qs');
const { lookup } = require('mime-types');
const WebSocket = require('ws');
const crypto = require('crypto');
const { isUrl } = require('../utils/commonUtils'); // Impor isUrl

// --- Helper untuk Remini ---
const getBufferRemini = async (url, options = {}) => {
    try {
        const res = await axios({
            method: "get", url, headers: { DNT: 1, 'Upgrade-Insecure-Request': 1 },
            ...options, responseType: 'arraybuffer'
        });
        return res.data;
    } catch (err) { throw err; }
};
const toolRemini = ['removebg', 'enhance', 'upscale', 'restore', 'colorize'];
const pxpicRemini = {
    upload: async (buffer, ext = 'png', mime = 'image/png') => {
        const fileName = Date.now() + "." + ext, folder = "uploads";
        const responsej = await axios.post("https://pxpic.com/getSignedUrl", { folder, fileName }, { headers: { "Content-Type": "application/json" } });
        const { presignedUrl } = responsej.data;
        await axios.put(presignedUrl, buffer, { headers: { "Content-Type": mime } });
        return "https://files.fotoenhancer.com/uploads/" + fileName;
    },
    create: async (buffer, tools) => {
        if (!toolRemini.includes(tools)) throw new Error(`Pilih salah satu dari tools ini: ${toolRemini.join(', ')}`);
        const imageUrl = await pxpicRemini.upload(buffer, 'png', 'image/png');
        let data = qs.stringify({
            imageUrl, targetFormat: 'png', needCompress: 'no', imageQuality: '100',
            compressLevel: '6', fileOriginalExtension: 'png', aiFunction: tools, upscalingLevel: ''
        });
        const config = {
            method: 'POST', url: 'https://pxpic.com/callAiFunction',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded', 'accept-language': 'id-ID'
            }, data
        };
        const api = await axios.request(config);
        return api.data;
    }
};
// --- END Helper untuk Remini ---


// === AI Hydromind ===
async function hydromindAI(content, model) {
    const form = new FormData();
    form.append('content', content);
    form.append('model', model);
    const { data } = await axios.post('https://mind.hydrooo.web.id/v1/chat/', form, {
        headers: { ...form.getHeaders() }
    });
    return data;
}
const aiHydromindController = async (req, res) => {
    try {
        const { text, model } = req.query;
        if (!text || !model) {
            return res.status(400).json({ status: false, error: 'Text and Model is required' });
        }
        const { result } = await hydromindAI(text, model);
        res.status(200).json({ status: true, result });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
};

// === Gemini Image ===
async function geminiImageAI(text, image) {
    const apiUrl = `https://gemini-api-5k0h.onrender.com/gemini/image`;
    const params = { q: text, url: image };
    const response = await axios.get(apiUrl, { params });
    return response.data.content || 'Failed Response Ai';
}
const geminiImageController = async (req, res) => {
    try {
        const { prompt, url } = req.query;
        if (!prompt || !url) {
            return res.status(400).json({ status: false, error: "prompt & url is required" });
        }
        const results = await geminiImageAI(prompt, url);
        res.status(200).json({ status: true, result: results.replaceAll("**", "*") });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
};

// === AI Luminai ===
async function luminaiAI(content) {
    const response = await axios.post('https://luminai.my.id/', { content });
    return response.data;
}
const aiLuminaiController = async (req, res) => {
    try {
        const { text } = req.query;
        if (!text) {
            return res.status(400).json({ status: false, error: 'Text is required' });
        }
        const { result } = await luminaiAI(text);
        res.status(200).json({ status: true, result });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
};

// === Bstation (Bibli) ===
class Bstation {
    search = async function (q) {
        let { data } = await axios.get("https://www.bilibili.tv/id/search-result?q=" + encodeURIComponent(q)).catch((e) => e.response);
        let $ = cheerio.load(data);
        let result = [];
        $(".bstar-video-card__text-wrap").each((index, element) => {
            const userName = $(element).find(".bstar-video-card__nickname span").text();
            const videoTitle = $(element).find(".highlights").text();
            const videoViews = $(element).find(".bstar-video-card__desc").text().trim();
            const userAvatar = $(element).find("img.bstar-image__img").attr("src");
            const videoElement = $(element).closest(".bstar-video-card").find(".bstar-video-card__cover-wrap");
            const videoLink = videoElement.find("a").attr("href");
            const videoThumbnail = videoElement.find("img.bstar-image__img").attr("src");
            const videoDuration = videoElement.find(".bstar-video-card__cover-mask-text--bold").text();
            if (!videoTitle) return;
            result.push({
                title: videoTitle, views: videoViews, url: "https:" + videoLink,
                tumbnail: videoThumbnail, duration: videoDuration,
                author: { name: userName, avatar: userAvatar }
            });
        });
        if (result.length === 0) throw new Error("Result not found!");
        return result;
    };
    download = async function (url) {
        let aid = /\/video\/(\d+)/.exec(url)?.[1];
        if (!aid) throw new Error("Invalid Bilibili video URL");
        const appInfo = await axios.get(url).then((res) => res.data);
        const $ = cheerio.load(appInfo);
        const title = $('meta[property="og:title"]').attr("content")?.split("|")[0].trim() || "Unknown Title";
        const locate = $('meta[property="og:locale"]').attr("content");
        const description = $('meta[property="og:description"]').attr("content");
        const type = $('meta[property="og:video:type"]').attr("content");
        const cover = $('meta[property="og:image"]').attr("content");
        const like = $(".interactive__btn.interactive__like .interactive__text").text();
        const views = $(".bstar-meta__tips-left .bstar-meta-text").first().text();
        let { data } = await axios.post("https://c.blahaj.ca/", { url: url },
            { headers: { Accept: "application/json", "Content-type": "application/json" } }
        ).catch((e) => e.response);
        if (!data.url) throw new Error("Failed to Download");
        return {
            metadata: { title, locate, thumbnail: cover, like, view: views, description },
            download: { url: data.url, filename: data.filename, type: type }
        };
    };
}
const bibliController = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ status: false, error: "Query is required" });
        let call = new Bstation();
        let result;
        if (isUrl(query)) {
            result = await call.download(query);
        } else {
            result = await call.search(query);
        }
        res.status(200).json({ status: true, result });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
};

// === Deepseek AI ===
async function deepseekAI(query) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions',
            { model: 'deepseek/deepseek-chat-v3-0324:free', messages: [{ role: 'user', content: query }] },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` } }
        );
        return response.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
    } catch (e1) {
      console.log("Deepseek OpenRouter failed, trying GitHub AI:", e1.message);
        try {
            let response = await axios.post('https://models.github.ai/inference/chat/completions',
                { messages: [{ role: 'system', content: '' }, { role: 'user', content: query }],
                  temperature: 0.8, top_p: 0.1, max_tokens: 2048, model: 'deepseek/DeepSeek-V3-0324' },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GITHUB_AI_TOKEN}` } }
            );
            let hasil = response.data.choices[0].message.content.replace("<think>", "");
            return hasil.replace(/\*\*(.*?)\*\*/g, '*$1*');
        } catch (e2) {
          console.log("Deepseek GitHub AI failed, trying Groq:", e2.message);
            try {
                let response = await axios.post("https://api.groq.com/openai/v1/chat/completions",
                    { messages: [{ role: "user", content: query }, { role: "assistant", content: "" }],
                      model: "llama3-70b-8192", temperature: 1, max_tokens: 300, top_p: 1, stream: false, stop: null }, // Model deepseek-r1-distill-llama-70b diganti ke llama3-70b-8192
                    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` } }
                );
                let hasil = response.data.choices[0]?.message?.content.replace("<think>", "");
                return hasil.replace(/\*\*(.*?)\*\*/g, '*$1*');
            } catch (e3) {
              console.log("Deepseek Groq failed, trying Cloudflare:", e3.message);
                const res = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/deepseek-ai/deepseek-math-7b-instruct`, // Model deepseek-r1-distill-qwen-32b diganti
                    { prompt: query }, // Cloudflare menggunakan 'prompt' bukan 'messages'
                    { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, 'Content-Type': 'application/json' } }
                );
                let hasil = res.data.result.response.replace("<think>", "");
                return hasil.replace(/\*\*(.*?)\*\*/g, '*$1*');
            }
        }
    }
}
const deepseekController = async (req, res) => {
    const { prompt } = req.query;
    if (!prompt) return res.status(400).json({ status: false, error: "Prompt is required" });
    try {
        const data = await deepseekAI(prompt);
        let result = data.replace(/\* \*/g, "• *");
        res.status(200).json({ status: true, result });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
};

// === Douyin ===
async function douyinDownload(url) {
    const apiUrl = "https://lovetik.app/api/ajaxSearch";
    const formData = new URLSearchParams();
    formData.append("q", url);
    formData.append("lang", "id");
    const response = await axios.post(apiUrl, formData.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "*/*", "X-Requested-With": "XMLHttpRequest" }
    });
    const data = response.data;
    if (data.status !== "ok") throw new Error("Gagal mengambil data Douyin.");
    const $ = cheerio.load(data.data);
    const title = $("h3").text();
    const thumbnail = $(".image-tik img").attr("src");
    const duration = $(".content p").text();
    const dl = [];
    $(".dl-action a").each((_, el) => {
        dl.push({ text: $(el).text().trim(), url: $(el).attr("href") });
    });
    return { title, thumbnail, duration, dl };
}
class DouyinSearchPage {
    constructor() {
        this.baseURL = 'https://so.douyin.com/'; this.cookies = {};
        this.defaultParams = { search_entrance: 'aweme', enter_method: 'normal_search', innerWidth: '431', innerHeight: '814', is_no_width_reload: '1', keyword: '' };
        this.api = axios.create({ baseURL: this.baseURL, headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8', 'accept-language': 'id-ID,id;q=0.9', referer: 'https://so.douyin.com/', 'upgrade-insecure-requests': '1', 'user-agent': 'Mozilla/5.0 (Linux; Android 10)' } });
        this.api.interceptors.response.use(res => { const setCookies = res.headers['set-cookie']; if (setCookies) setCookies.forEach(c => { const [name, value] = c.split(';')[0].split('='); if (name && value) this.cookies[name] = value; }); return res; });
        this.api.interceptors.request.use(config => { if (Object.keys(this.cookies).length) config.headers['Cookie'] = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); return config; });
    }
    async initialize() { try { await this.api.get('/'); return true; } catch { return false; } }
    async search(query) {
        await this.initialize();
        const res = await this.api.get('s', { params: { ...this.defaultParams, keyword: query, reloadNavStart: String(Date.now()) } });
        const $ = cheerio.load(res.data); let scriptWithData = '';
        $('script').each((_, el) => { const t = $(el).html(); if (t.includes('let data =') && t.includes('"business_data":')) scriptWithData = t; });
        const match = scriptWithData.match(/let\s+data\s*=\s*(\{[\s\S]+?\});/); if (!match) throw new Error('Data object not found');
        const sandbox = {}; vm.createContext(sandbox); vm.runInContext(`data = ${match[1]}`, sandbox);
        const data = sandbox.data?.business_data; if (!data) throw new Error('Not found');
        return data.map(e => e?.data?.aweme_info).filter(Boolean);
    }
}
const douyinController = async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, error: "Query parameter 'url' is required" });
    try {
        if (isUrl(url)) {
            const result = await douyinDownload(url);
            res.json({ status: true, result });
        } else {
            const searcher = new DouyinSearchPage();
            const result = await searcher.search(url);
            res.json({ status: true, result });
        }
    } catch (e) { res.status(500).json({ status: false, error: e.message || String(e) }); }
};

// === Genshin Stalk ===
const characterMapGenshin = { 10000007: 'Traveler (Anemo)', 10000005: 'Traveler (Geo)', 10000021: 'Amber', 10000022: 'Barbara', 10000023: 'Beidou', 10000024: 'Bennett', 10000025: 'Chongyun', 10000026: 'Diluc', 10000027: 'Fischl', 10000028: 'Jean', 10000029: 'Kaeya', 10000030: 'Keqing', 10000031: 'Lisa', 10000032: 'Mona', 10000033: 'Ningguang', 10000034: 'Noelle', 10000035: 'Qiqi', 10000036: 'Razor', 10000037: 'Sucrose', 10000038: 'Venti', 10000039: 'Xiangling', 10000040: 'Xingqiu', 10000041: 'Xinyan', 10000042: 'Zhongli', 10000043: 'Xiao', 10000044: 'Hu Tao', 10000045: 'Kazuha', 10000046: 'Ayaka', 10000047: 'Yoimiya', 10000048: 'Sayu', 10000049: 'Raiden Shogun', 10000050: 'Kokomi' };
async function genshinStalk(uid) {
    const url = `https://enka.network/api/uid/${uid}`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!data || !data.playerInfo) throw new Error('Data tidak ditemukan');
    const { playerInfo } = data;
    return {
        uid: data.uid, nickname: playerInfo.nickname, level: playerInfo.level, nameCardId: playerInfo.nameCardId,
        avatar: characterMapGenshin[playerInfo.profilePicture?.avatarId] || `Unknown (${playerInfo.profilePicture?.avatarId})`,
        characters: playerInfo.showAvatarInfoList?.map(char => ({
            id: char.avatarId, name: characterMapGenshin[char.avatarId] || `Unknown (${char.avatarId})`,
            level: char.level, costumeId: char.costumeId || null
        })) || []
    };
}
const genshinStalkController = async (req, res) => {
    try {
        const { q } = req.query; if (!q) return res.status(400).json({status: false, error: "Input Your Query"});
        const result = await genshinStalk(q);
        res.status(200).json({ status: true, result });
    } catch (error) { res.status(500).json({status: false, error: error.message}); }
};

// === Gemini Chat ===
async function geminiChatAI(prompt) {
    const apiUrl = `https://gemini-api-5k0h.onrender.com/gemini/chat`;
    const params = { q: prompt };
    const response = await axios.get(apiUrl, { params });
    return response.data?.content || 'Failed Response Ai';
}
const geminiController = async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) { return res.status(400).json({ status: false, error: "prompt required" }); }
        const result = await geminiChatAI(prompt);
        res.status(200).json({ status: true, result: result.replaceAll("**", "*") });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Hero ML Detail ===
async function detailHeroML(heroName) {
    const url = `https://mobile-legends.fandom.com/wiki/${encodeURIComponent(heroName)}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const heroData = {
        title: $('h1.page-header__title').text().trim(),
        role: $('div[data-source="role"] .pi-data-value').text().trim(),
        speciality: $('div[data-source="specialty"] .pi-data-value').text().trim(),
        lane: $('div[data-source="lane"] .pi-data-value').text().trim()
    };
    if (!heroData.title) throw new Error("Hero not found");
    return heroData;
}
const heroMlController = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ status: false, error: "Input query Hero Ml" });
        const result = await detailHeroML(q);
        res.status(200).json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === GPT 4.1 ===
async function gpt41AI(query) {
    try {
        const url = "https://models.github.ai/inference/chat/completions";
        const data = { messages: [{ role: "system", content: "" }, { role: "user", content: query }], temperature: 1, top_p: 1, model: "openai/gpt-4" }; // gpt-4.1
        const res = await axios.post(url, data, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GITHUB_AI_TOKEN}` } });
        return res.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
    } catch (e1) {
        console.log("GPT-4 failed, trying GPT-4-mini:", e1.message);
        const url = "https://models.github.ai/inference/chat/completions";
        const data = { messages: [{ role: "system", content: "" }, { role: "user", content: query }], temperature: 1, top_p: 1, model: "openai/gpt-4-turbo" }; // gpt-4.1-mini / gpt-4-turbo
        const res = await axios.post(url, data, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GITHUB_AI_TOKEN}` } });
        return res.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
    }
}
const gpt41Controller = async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) return res.status(400).json({ status: false, error: "prompt is required" });
        const result = await gpt41AI(prompt);
        res.status(200).json({ status: true, result: result.replaceAll("**", "*") });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === Google Search (Mojeek) ===
async function mojeekSearch(query) {
    const { data } = await axios.get('https://www.mojeek.com/search', { params: { q: query }, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const results = [];
    $('ul.results-standard li').each((_, el) => {
        const title = $(el).find('h2 a.title').text().trim();
        const url = $(el).find('a.ob').attr('href');
        const description = $(el).find('p.s').text().trim();
        if (title && url) results.push({ title, url, description });
    });
    if (results.length === 0) throw new Error("No results found");
    return results;
}
const googleSearchController = async (req, res) => {
    const query = req.query.q;
    if (!query) { return res.status(400).json({ status: false, error: 'Query parameter "q" is required.' }); }
    try {
        const result = await mojeekSearch(query);
        res.status(200).json({ status: true, result });
    } catch (err) { res.status(500).json({ status: false, error: 'Failed to fetch data from search.', detail: err.message }); }
};

// === GPT 4 Turbo (alias gpt4-o) ===
async function gpt4oAI(query) {
    const response = await axios.post('https://models.github.ai/inference/chat/completions',
        { messages: [{ role: 'system', content: '' }, { role: 'user', content: query }], temperature: 1, top_p: 1, model: 'openai/gpt-4-turbo' }, // gpt-4.1
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GITHUB_AI_TOKEN}` } }
    );
    return response.data.choices[0].message.content;
}
const gpt4oController = async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) { return res.status(400).json({ status: false, error: "prompt is required" }); }
        const result = await gpt4oAI(prompt);
        res.status(200).json({ status: true, result: result.replaceAll("**", "*") });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Image to Anime (PixNova) ===
async function pixNovaToAnime(imageUrl) {
    const WS_URL = "wss://pixnova.ai/demo-photo2anime/queue/join";
    const IMAGE_URL_BASE = "https://oss-global.pixnova.ai/";
    const SESSION_HASH = crypto.randomBytes(5).toString("hex").slice(0, 9);
    let wssInstance, currentPromise;

    function connectPixNova(log) {
        return new Promise((resolve, reject) => {
            wssInstance = new WebSocket(WS_URL);
            wssInstance.on("open", () => { if (log) console.log("PixNova WebSocket Connected."); resolve(); });
            wssInstance.on("error", e => { console.error("PixNova WebSocket Error:", e); reject(e); });
            wssInstance.on("message", chunk => {
                const data = JSON.parse(chunk.toString());
                if (currentPromise?.once) { currentPromise.call(data); currentPromise = null; }
                else if (currentPromise) {
                    if (log) console.log("PixNova Message:", data);
                    if (data?.code === 200 && data?.success) {
                        data.output.result = data.output.result.map(x => IMAGE_URL_BASE + x);
                        currentPromise.call(data); currentPromise = null;
                    } else if (data?.success === false) { // Handle explicit failure
                        currentPromise.reject(new Error(data.message || "PixNova processing failed"));
                        currentPromise = null;
                    }
                }
            });
        });
    }
    function sendPixNova(payload, isOnce) {
        return new Promise((resolve, reject) => { // Added reject here
            wssInstance.send(JSON.stringify(payload));
            currentPromise = { once: isOnce, call: resolve, reject: reject }; // Added reject callback
        });
    }
    let base64Image;
    if (/https?:\/\//i.test(imageUrl)) {
        const r = await axios.get(imageUrl, { responseType: "arraybuffer" });
        base64Image = Buffer.from(r.data).toString("base64");
    } else if (Buffer.isBuffer(imageUrl)) {
        base64Image = imageUrl.toString("base64");
    } else {
        base64Image = imageUrl;
    }
    await connectPixNova(true);
    await sendPixNova({ session_hash: SESSION_HASH }, true);
    return await sendPixNova({
        data: {
            source_image: `data:image/jpeg;base64,${base64Image}`, strength: 0.65,
            prompt: "(masterpiece), (best quality), (anime style), vibrant colors, soft lighting, highly detailed, aesthetic background, dynamic composition, beautiful face, anime eyes, cinematic shading",
            negative_prompt: "(low quality:1.4), blurry, cropped, watermark, text, logo, extra fingers, extra limbs, bad anatomy, sketch, monochrome, grayscale",
            request_from: 2
        }
    }, false);
}
const toAnimeController = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const result = await pixNovaToAnime(url);
        res.status(200).json({ status: true, result: result.output }); // Adjusted to result.output based on PixNova structure
    } catch (e) { res.status(500).json({ status: false, error: e.message || "Internal Server Error" }); }
};

// === IG Stalk ===
async function igStalk(username) {
    const data = qs.stringify({ url: `@${username}` });
    const config = { method: 'POST', url: 'https://app.mailcamplly.com/api/instagram-profile', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36', 'Referer': 'https://bitchipdigital.com/tools/social-media/instagram-profile-viewer/' }, data };
    const igRes = await axios(config);
    if (!igRes.data || !igRes.data[0]) throw new Error("Gagal mengambil data profil atau format respons tidak sesuai.");
    let p = igRes.data[0];
    return {
        username: p.account || '', name: p.profile_name || '', followers: p.followers || 0,
        url: p.profile_url || '', profile_image: p.profile_image_link || ''
    };
}
const igStalkController = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({status: false, error:"Input Your Query"});
        const result = await igStalk(q);
        res.status(200).json({ status: true, result });
    } catch (e) { res.status(500).json({status: false, error: e.message}); }
};

// === MediaFire Downloader ===
async function mediafireDL(url) {
    const res = await axios.get(url); // undici fetch diganti axios
    const html = res.data; // await res.text() diganti res.data
    const $ = cheerio.load(html);
    const downloadButton = $(".download_link .input");
    const filename = $(".dl-btn-label").attr("title");
    const downloadLink = downloadButton.attr("href");
    const sizeText = $(".dl-info").text().match(/(\d+(?:\.\d+)?\s*(?:MB|KB|GB))/i);
    const size = sizeText ? sizeText[1] : null;
    if (!downloadLink) throw new Error("Download link not found");
    const ext = filename?.split(".").pop() || "bin";
    const mimetype = lookup(ext.toLowerCase()) || "application/" + ext.toLowerCase();
    return { metadata: { filename, type: ext, size, ext, mimetype }, link: { download: downloadLink } };
}
const mediafireController = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const result = await mediafireDL(url);
        res.status(200).json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === Instagram Downloader (SSSInstagram) ===
async function getServerTimeSSS() { try { const { data } = await axios.get('https://sssinstagram.com/msec', { timeout: 5000 }); return Math.floor(data.msec * 1000); } catch { return Date.now(); } }
function generateSignatureSSS(url, secretKey, timestamp) { const adjustedTime = Date.now() - (timestamp ? Date.now() - timestamp : 0); const raw = `${url}${adjustedTime}${secretKey}`; const hash = crypto.createHash('sha256').update(raw).digest('hex'); return { signature: hash, adjustedTime }; }
async function instagramDL_SSS(url) {
    const secretKey = '19e08ff42f18559b51825685d917c5c9e9d89f8a5c1ab147f820f46e94c3df26';
    const timestamp = await getServerTimeSSS();
    const { signature, adjustedTime } = generateSignatureSSS(url, secretKey, timestamp);
    const payload = { url, ts: adjustedTime, _ts: 1739186038417, _tsc: Date.now() - timestamp, _s: signature };
    const headers = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://sssinstagram.com/', 'Origin': 'https://sssinstagram.com/' };
    const { data } = await axios.post('https://sssinstagram.com/api/convert', payload, { headers, timeout: 10000 });
    if (!data || data.status !== "ok" || !data.data || !data.data.items || data.data.items.length === 0) throw new Error('Gagal mengambil data dari Instagram atau format respons tidak sesuai.');
    return data.data; // Mengembalikan object data dari SSSInstagram
}
const instagramController = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) { return res.status(400).json({ status: false, error: "Url is required" }); }
        const result = await instagramDL_SSS(url);
        res.status(200).json({ status: true, result });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Remini Tools (enhance, upscale, restore, colorize, removebg) ===
const reminiToolController = (toolName) => async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ status: false, error: "url is required" });
        const buffer = await getBufferRemini(url);
        const { resultImageUrl } = await pxpicRemini.create(buffer, toolName);
        res.status(200).json({ status: true, result: resultImageUrl });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === Lirik (Genius) ===
async function lirikGenius(title) {
    const searchUrl = `https://genius.com/api/search/song?q=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const song = searchRes.data.response.sections[0]?.hits[0]?.result;
    if (!song) throw new Error("Song not found");
    const lyricsRes = await axios.get(song.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(lyricsRes.data);
    $('div[class*="Lyrics__NoteWrapper"]').remove(); $('div[class*="Lyrics__Footer"]').remove(); $('div[class*="Lyrics__Description"]').remove();
    const lyricsContainer = $('div[class*="Lyrics__Container"]');
    let lyricsText = lyricsContainer.text();
    let lirik = lyricsText.replace(/\d+ Contributors/g, '').replace(/Translations\w+/g, '').replace(/العربيةDeutschPortuguêsFrançaiso‘zbekTürkçeEspañolItal\w+/g, '').replace(/Read More/g, '').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '').replace(/([^]+)/g, '\n\n[$1]\n').replace(/\[([^\]]+)\]/g, '\n\n[$1]\n');
    const firstNewline = lirik.indexOf('\n'); if (firstNewline !== -1) { lirik = lirik.slice(firstNewline + 1).replace(/([^.\n])\s([A-Z][a-z])/g, '$1\n$2'); }
    return { title: song.title, author: song.primary_artist.name, url: song.url, image: song.header_image_thumbnail_url, release: song.release_date_for_display, lirik: lirik.replace(/([a-z])([A-Z])/g, '$1\n$2') };
}
const lirikController = async (req, res) => {
    try {
        const { q } = req.query; if (!q) { return res.status(400).json({ status: false, error: "query required" }); }
        const result = await lirikGenius(q);
        res.status(200).json({ status: true, result: result });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Meta Llama AI ===
async function metaLlamaAI(query) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions',
            { model: "meta-llama/llama-3-8b-instruct:free", messages: [{ role: "user", content: query }] }, // Llama-4-maverick diganti
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` } }
        );
        return response.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
    } catch (e1) {
        console.log("Meta OpenRouter failed, trying Groq:", e1.message);
        try {
            const res = await axios.post("https://api.groq.com/openai/v1/chat/completions",
                { messages: [{ role: "user", content: query }, { role: "assistant", content: "" }], model: "llama3-70b-8192", temperature: 1, max_completion_tokens: 1024, top_p: 1, stream: false, stop: null },
                { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` } }
            );
            return res.data.choices[0]?.message?.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
        } catch (e2) {
            console.log("Meta Groq failed, trying Cloudflare:", e2.message);
            const res = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
                { prompt: query }, // Cloudflare menggunakan 'prompt'
                { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, 'Content-Type': 'application/json' } }
            );
            return res.data.result.response.replace(/\*\*(.*?)\*\*/g, '*$1*');
        }
    }
}
const metaController = async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) return res.status(400).json({ status: false, error: "prompt is required" });
        const result = await metaLlamaAI(prompt);
        res.status(200).json({ status: true, result: result.replaceAll("**", "*") });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === Pinterest ===
const pinterestBase = "https://www.pinterest.com", pinterestSearchPath = "/resource/BaseSearchResource/get/";
const pinterestHeaders = { accept: 'application/json, text/javascript, */*, q=0.01', referer: pinterestBase, 'user-agent': 'Postify/1.0.0', 'x-app-version': 'a9522f', 'x-pinterest-appstate': 'active', 'x-pinterest-pws-handler': 'www/[username]/[slug].js', 'x-pinterest-source-url': '/search/pins/?rs=typed&q=kucing%20anggora/', 'x-requested-with': 'XMLHttpRequest' };
async function getPinterestCookies() { try { const res = await axios.get(pinterestBase); const cookies = res.headers['set-cookie']?.map(c => c.split(';')[0].trim()).join('; '); return cookies || null; } catch { return null; } }
class Pinterest {
    search = async function (query) {
        if (!query) throw new Error("Query kosong. Isi dulu dong.");
        const cookies = await getPinterestCookies(); if (!cookies) throw new Error("Gagal ambil cookies.");
        const params = { source_url: `/search/pins/?q=${query}`, data: JSON.stringify({ options: { isPrefetch: false, query, scope: "pins", bookmarks: [""], no_fetch_context_on_resource: false, page_size: 20 }, context: {} }), _: Date.now() };
        const { data } = await axios.get(`${pinterestBase}${pinterestSearchPath}`, { headers: { ...pinterestHeaders, cookie: cookies }, params });
        const results = data.resource_response.data.results.filter(v => v.images?.orig).map(v => ({ metadata: { title: v.title || "", id: v.id, description: v.description }, images: v.images.orig.url }));
        if (!results.length) throw new Error(`Gak nemu hasil buat "${query}". Coba kata kunci lain.`);
        return results;
    };
    download = async function (url) {
        const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(data);
        const tag = $('script[data-test-id="video-snippet"]');
        if (tag.length) {
            const videoData = JSON.parse(tag.text());
            if (!videoData?.name || !videoData?.contentUrl) throw new Error("Data video tidak ditemukan.");
            return { title: videoData.name, username: "@" + videoData.creator?.name, mimetype: "video/mp4", download: videoData.contentUrl };
        }
        const json = JSON.parse($("script[data-relay-response='true']").eq(0).text());
        const d = json.response.data["v3GetPinQuery"]?.data;
        if (!d?.imageLargeUrl) throw new Error("Data gambar tidak ditemukan.");
        return { title: d.title, username: "@" + d.pinner?.username, mimetype: "image/jpeg", download: d.imageLargeUrl };
    };
}
const pinterestController = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ status: false, error: "Query is required" });
        const p = new Pinterest();
        const result = isUrl(query) ? await p.download(query) : await p.search(query);
        res.status(200).json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === Spotify Downloader ===
const base64EncodingUrlSpotify = (trackUrl, trackName, artistName) => { const data = `__/:${trackUrl}:${trackName}:${artistName}`; return Buffer.from(data).toString('base64'); };
const spotifyHeaders = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36', 'Referer': 'https://spotify-down.com/' };
async function spotifydownDL(url) {
    if (!/open.spotify.com/.test(url)) throw new Error("Input Url from Spotify!");
    const config = { method: 'post', url: 'https://spotify-down.com/api/metadata', params: { link: url }, ...spotifyHeaders };
    const { data: metadataResponse } = await axios(config);
    if (!metadataResponse.success || !metadataResponse.data) throw new Error("Failed to get metadata from Spotify-Down");
    const trackData = metadataResponse.data;
    const base64EncodedT = base64EncodingUrlSpotify(trackData.link, trackData.title, trackData.artists);
    const { data: downloadResponse } = await axios.get('https://spotify-down.com/api/download', {
        params: { link: trackData.link, n: trackData.title, a: trackData.artists, t: base64EncodedT },
        headers: spotifyHeaders
    });
    if (!downloadResponse.success || !downloadResponse.data || !downloadResponse.data.link) throw new Error("Failed to get download link from Spotify-Down");
    return { status: true, success: 200, metadata: trackData, download: downloadResponse.data.link };
}
const spotifyController = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "url is required" });
        const result = await spotifydownDL(url);
        res.status(200).json({ status: true, result });
    } catch (err) { res.status(500).json({ status: false, error: err.message }); }
};

// === Twitter (X) Downloader ===
async function xdownDL(url) {
    const { data } = await axios.post("https://twmate.com/", new URLSearchParams({ page: url, ftype: "all", ajax: "1" }), { headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "*/*", "X-Requested-With": "XMLHttpRequest", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36", Referer: "https://twmate.com/" } });
    const $ = cheerio.load(data); const videoLinks = [];
    $(".btn-dl").each((i, e) => {
        const quality = $(e).parent().prev().text().trim();
        const downloadUrl = $(e).attr("href");
        if (downloadUrl && downloadUrl.includes(".mp4")) videoLinks.push({ quality, downloadUrl });
    });
    if (!videoLinks.length) throw new Error("Gagal mengambil video. Pastikan URL benar dan video publik.");
    return videoLinks[0]; // Mengembalikan video dengan kualitas terbaik yang ditemukan pertama
}
const twitterController = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "url is required" });
        const result = await xdownDL(url);
        res.status(200).json({ status: true, result }); // Mengembalikan objek result langsung
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Image to Zombie (PixNova) ===
async function pixNovaToZombie(imageUrl) {
    const WS_URL = "wss://pixnova.ai/demo-photo2anime/queue/join";
    const IMAGE_URL_BASE = "https://oss-global.pixnova.ai/";
    const SESSION_HASH = crypto.randomBytes(5).toString("hex").slice(0, 9);
    let wssInstance, currentPromise;

    function connectPixNovaZombie(log) {
        return new Promise((resolve, reject) => {
            wssInstance = new WebSocket(WS_URL);
            wssInstance.on("open", () => { if (log) console.log("PixNova (Zombie) WebSocket Connected."); resolve(); });
            wssInstance.on("error", e => { console.error("PixNova (Zombie) WebSocket Error:", e); reject(e); });
            wssInstance.on("message", chunk => {
                const data = JSON.parse(chunk.toString());
                if (currentPromise?.once) { currentPromise.call(data); currentPromise = null; }
                else if (currentPromise) {
                    if (log) console.log("PixNova (Zombie) Message:", data);
                    if (data?.code === 200 && data?.success) {
                        data.output.result = data.output.result.map(x => IMAGE_URL_BASE + x);
                        currentPromise.call(data); currentPromise = null;
                    }  else if (data?.success === false) {
                        currentPromise.reject(new Error(data.message || "PixNova (Zombie) processing failed"));
                        currentPromise = null;
                    }
                }
            });
        });
    }
    function sendPixNovaZombie(payload, isOnce) {
         return new Promise((resolve, reject) => {
            wssInstance.send(JSON.stringify(payload));
            currentPromise = { once: isOnce, call: resolve, reject: reject };
        });
    }
    let base64Image;
    if (/https?:\/\//i.test(imageUrl)) {
        const r = await axios.get(imageUrl, { responseType: "arraybuffer" });
        base64Image = Buffer.from(r.data).toString("base64");
    } else if (Buffer.isBuffer(imageUrl)) {
        base64Image = imageUrl.toString("base64");
    } else {
        base64Image = imageUrl;
    }
    await connectPixNovaZombie(true);
    await sendPixNovaZombie({ session_hash: SESSION_HASH }, true);
    return await sendPixNovaZombie({
        data: {
            source_image: `data:image/jpeg;base64,${base64Image}`, strength: 0.7,
            prompt: "zombie, undead, decayed face, horror, blood, rotting skin, glowing eyes, terrifying, apocalypse survivor, dark atmosphere, detailed horror art, cinematic lighting",
            negative_prompt: "cute, beautiful, clean face, low quality, blurry, watermark, cartoon, anime, sketch, colorful background",
            request_from: 2
        }
    }, false);
}
const toZombieController = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const result = await pixNovaToZombie(url);
        res.status(200).json({ status: true, result: result.output });
    } catch (e) { res.status(500).json({ status: false, error: e.message || "Internal Server Error" }); }
};

// === YouTube MP4 Downloader (ytmp3.mobi) ===
async function ytmp4Mobi(youtubeUrl) {
    const regYoutubeId = /https:\/\/(www.youtube.com\/watch\?v=|youtu.be\/|youtube.com\/shorts\/|youtube.com\/watch\?v=)([^&|^?]+)/;
    const videoId = youtubeUrl.match(regYoutubeId)?.[2];
    if (!videoId) throw Error("Can't extract YouTube video ID.");
    const urlParam = { v: videoId, f: "mp4", _: Math.random() };
    const headers = { "Referer": "https://id.ytmp3.mobi/" };
    const fetchJson = async (url, fetchDescription) => {
        const res = await axios.get(url, { headers }); // Menggunakan axios.get
        if (res.status !== 200) throw Error(`Fetch failed on ${fetchDescription} | ${res.status} ${res.statusText}`);
        return res.data; // Mengembalikan res.data langsung
    };
    const { convertURL } = await fetchJson("https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=" + Math.random(), "get convertURL");
    const { progressURL, downloadURL: initialDownloadURL } = await fetchJson(`${convertURL}&${new URLSearchParams(urlParam).toString()}`, "get progressURL and downloadURL");
    let error, progress, title;
    let finalDownloadURL = initialDownloadURL; // Simpan URL awal
    while (progress != 3) {
        ({ error, progress, title, downloadURL: currentDownloadURL } = await fetchJson(progressURL, "fetch progressURL"));
        if (error) throw Error(`Error found: ${error}`);
        if (currentDownloadURL) finalDownloadURL = currentDownloadURL; // Update jika ada URL baru
        // console.log(`[${progress == 1 ? "loading" : progress == 2 ? "converting" : "unknown"}] ${title}`);
    }
    return { title, downloadURL: finalDownloadURL };
}
const ytmp4Controller = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const result = await ytmp4Mobi(url);
        res.status(200).json({ status: true, result });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Text to Image (texttoimage.org) ===
const textToImageOrgBase = "https://www.texttoimage.org";
const textToImageOrgHeaders = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Origin: textToImageOrgBase, Referer: `${textToImageOrgBase}/`, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" };
async function text2imgOrg(prompt) {
    if (!prompt) throw new Error("Prompt is required");
    let q = new URLSearchParams({ prompt });
    let { data: generateData } = await axios.post(`${textToImageOrgBase}/generate`, q, { headers: textToImageOrgHeaders });
    if (!generateData.url) throw new Error("Failed to get generation URL from texttoimage.org");
    let { data: htmlData } = await axios.get(`${textToImageOrgBase}/${generateData.url}`, { headers: textToImageOrgHeaders });
    const $ = cheerio.load(htmlData);
    let imageUrl = $(".image-container").find("img").attr("src");
    if (!imageUrl) throw new Error("Failed to find image in generated page");
    return { status: true, result: textToImageOrgBase + imageUrl };
}
const text2imgController = async (req, res) => {
    try {
        const { prompt } = req.query; if (!prompt) return res.status(400).json({status: false, error: "Prompt is required"});
        const { data: translateData } = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q=${encodeURIComponent(prompt).replace(/%20/g, '+')}`);
        const translatedPrompt = translateData[0]?.[0]?.[0];
        if (!translatedPrompt) throw new Error("Failed to translate prompt");
        const result = await text2imgOrg(translatedPrompt);
        if (!result.status) return res.status(500).json({ status: false, error: result.result });
        res.status(200).json({ status: true, result: result.result }); // result adalah URL langsung
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};

// === YouTube MP3 Downloader (Savetube) ===
const savetubeApi = { base: "https://media.savetube.me/api", cdn: "/random-cdn", info: "/v2/info", download: "/download" };
const savetubeHeaders = { accept: "*/*", "content-type": "application/json", origin: "https://yt.savetube.me", referer: "https://yt.savetube.me/", "user-agent": "Postify/1.0.0" };
const savetubeFormatVideo = ["144", "240", "360", "480", "720", "1080", "1440", "2k", "3k", "4k", "5k", "8k"];
const savetubeFormatAudio = ["mp3", "m4a", "webm", "aac", "flac", "opus", "ogg", "wav"];
async function savetubeDL(link, format) {
    const cryptooSavetube = { hexToBuffer: (hex) => Buffer.from(hex.match(/.{1,2}/g)?.join("") || "", "hex") }; // Added null check
    const decryptSavetube = async (enc) => {
        const key = cryptooSavetube.hexToBuffer("C5D58EF67A7584E4A29F6C35BBC4EB12");
        const data = Buffer.from(enc, "base64"), iv = data.slice(0, 16), content = data.slice(16);
        const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    };
    const youtubeIdSavetube = (url) => { if (!url) return null; const patterns = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/]; for (const p of patterns) if (p.test(url)) return url.match(p)[1]; return null; };
    const requestSavetube = async (endpoint, data = {}, method = "post") => {
        const res = await axios({ method, url: `${endpoint.startsWith("http") ? "" : savetubeApi.base}${endpoint}`, data: method === "post" ? data : undefined, params: method === "get" ? data : undefined, headers: savetubeHeaders });
        return { status: true, code: res.status, data: res.data };
    };
    const getCDNSavetube = async () => { const response = await requestSavetube(savetubeApi.cdn, {}, "get"); if (!response.status || !response.data.cdn) throw new Error("Failed to get CDN from Savetube"); return response.data.cdn; };
    if (!link) throw new Error("Link is required"); if (!isUrl(link)) throw new Error("Invalid YouTube link");
    const allFormatsSavetube = [...savetubeFormatVideo, ...savetubeFormatAudio];
    if (!format || !allFormatsSavetube.includes(format)) throw new Error(`Invalid format. Available: ${allFormatsSavetube.join(", ")}`);
    const id = youtubeIdSavetube(link); if (!id) throw new Error("Invalid YouTube link, ID not found");
    const cdn = await getCDNSavetube();
    const infoResult = await requestSavetube(`https://${cdn}${savetubeApi.info}`, { url: `https://www.youtube.com/watch?v=${id}` });
    if (!infoResult.status || !infoResult.data.data) throw new Error("Failed to get video info from Savetube");
    const decrypted = await decryptSavetube(infoResult.data.data);
    const downloadResult = await requestSavetube(`https://${cdn}${savetubeApi.download}`, { id, downloadType: savetubeFormatAudio.includes(format) ? "audio" : "video", quality: savetubeFormatAudio.includes(format) ? "128" : format, key: decrypted.key });
    if (!downloadResult.status || !downloadResult.data.data || !downloadResult.data.data.downloadUrl) throw new Error("Failed to get download link from Savetube");
    const timeFormat = (v) => { let sec = parseInt(v, 10), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? (h < 10 ? "0" + h : h) + ":" : "") + (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s); };
    return { status: true, code: 200, result: { metadata: { quality: savetubeFormatAudio.includes(format) ? "128" : format, title: decrypted.title || "Unknown Title", id, duration: timeFormat(decrypted.duration), url: `https://youtube.com/watch?v=${id}` }, media: downloadResult.data.data.downloadUrl } };
}
const ytmp3Controller = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const data = await savetubeDL(url, "mp3"); // result sudah di dalam data
        if (!data.status) return res.status(data.code || 500).json({ status: false, error: data.error });
        res.status(200).json({ status: true, result: data.result }); // Akses data.result
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
};

// === Whisper (Audio Transcription) ===
async function transkripAudio(urlnya) {
    const response = await axios.get(urlnya, { responseType: 'arraybuffer' });
    const form = new FormData();
    form.append('file', response.data, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
    form.append('model', 'whisper-large-v3');
    const { data } = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form,
        { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } }
    );
    return data.text;
}
const whisperController = async (req, res) => {
    try {
        const { url } = req.query; if (!url) { return res.status(400).json({ status: false, error: "Parameter URL diperlukan" }); }
        const hasilTranskrip = await transkripAudio(url);
        res.status(200).json({ status: true, result: hasilTranskrip });
    } catch (error) { res.status(500).json({ status: false, error: error.response?.data?.error?.message || error.message }); }
};

// === TikTok Downloader (TikWM) ===
async function tiktokDL_TikWM(url) {
    const response = await axios.post("https://www.tikwm.com/api/?url=" + encodeURIComponent(url) + "&hd=1"); // Ditambahkan encodeURIComponent
    if (!response.data || response.data.code !== 0 || !response.data.data) throw new Error("Failed to download TikTok video or invalid response format.");
    return response.data.data; // Mengembalikan object data dari TikWM
}
const tiktokController = async (req, res) => {
    try {
        const { url } = req.query; if (!url) return res.status(400).json({ status: false, error: "Url is required" });
        const result = await tiktokDL_TikWM(url);
        res.status(200).json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, error: e.message }); }
};


module.exports = {
    aiHydromindController,
    geminiImageController,
    aiLuminaiController,
    bibliController,
    deepseekController,
    douyinController,
    genshinStalkController,
    geminiController,
    heroMlController,
    gpt41Controller,
    googleSearchController,
    gpt4oController,
    toAnimeController,
    igStalkController,
    mediafireController,
    instagramController,
    enhanceController: reminiToolController('enhance'),
    upscaleController: reminiToolController('upscale'),
    restoreController: reminiToolController('restore'),
    colorizeController: reminiToolController('colorize'),
    removebgController: reminiToolController('removebg'),
    lirikController,
    metaController,
    pinterestController,
    spotifyController,
    twitterController,
    toZombieController,
    ytmp4Controller,
    text2imgController,
    ytmp3Controller,
    whisperController,
    tiktokController,
};