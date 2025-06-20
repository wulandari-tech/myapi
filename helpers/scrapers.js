const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');
const cheerio = require('cheerio');
const crypto = require('crypto');
const vm = require('vm');
const { lookup } = require('mime-types');
const qs = require('qs'); 
const { fetch } = require('undici');
function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function hydromind(content, model) {
    const form = new FormData();
    form.append('content', content);
    form.append('model', model);
    const { data } = await axios.post('https://mind.hydrooo.web.id/v1/chat/', form, {
        headers: { ...form.getHeaders() },
        timeout: 15000
    });
    return data;
}

async function luminaiFetchContent(content) {
    try {
        const response = await axios.post('https://luminai.my.id/', { content }, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error("Error fetching content from LuminAI:", error.message);
        throw error;
    }
}

async function deepseekAI(query) {
    const openRouterKey = process.env.OPENROUTER_API_KEY; // GANTI DENGAN ENV
    const githubToken = process.env.GITHUB_AI_TOKEN; // GANTI DENGAN ENV
    const groqKey = process.env.GROQ_API_KEY; // GANTI DENGAN ENV
    const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID; // GANTI DENGAN ENV
    const cloudflareKey = process.env.CLOUDFLARE_AI_TOKEN; // GANTI DENGAN ENV

    try {
        if (openRouterKey) {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions',
                { model: 'deepseek/deepseek-chat', messages: [{ role: 'user', content: query }] },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openRouterKey}` }, timeout: 20000 }
            );
            return response.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
        }
        throw new Error("OpenRouter key not configured");
    } catch (e1) {
        console.warn("Deepseek OpenRouter failed:", e1.message);
        try {
            if (githubToken) {
                let response = await axios.post('https://models.github.ai/inference/chat/completions',
                    { messages: [{ role: 'system', content: '' }, { role: 'user', content: query }], temperature: 0.8, top_p: 0.1, max_tokens: 2048, model: 'deepseek/DeepSeek-V2-Chat' }, // Model mungkin perlu update
                    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${githubToken}` }, timeout: 20000 }
                );
                return response.data.choices[0].message.content.replace("<think>", "").replace(/\*\*(.*?)\*\*/g, '*$1*');
            }
            throw new Error("GitHub AI token not configured");
        } catch (e2) {
            console.warn("Deepseek GitHub AI failed:", e2.message);
            try {
                if (groqKey) {
                    let response = await axios.post("https://api.groq.com/openai/v1/chat/completions",
                        { messages: [{ role: "user", content: query }, { role: "assistant", content: "" }], "model": "mixtral-8x7b-32768", temperature: 1, "max_tokens": 300, "top_p": 1, stream: false, stop: null }, // Model Groq mungkin perlu update
                        { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` }, timeout: 20000 }
                    );
                    return response.data.choices[0]?.message?.content.replace("<think>", "").replace(/\*\*(.*?)\*\*/g, '*$1*');
                }
                throw new Error("Groq API key not configured");
            } catch (e3) {
                console.warn("Deepseek Groq failed:", e3.message);
                try {
                    if (cloudflareId && cloudflareKey) {
                        const res = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/run/@cf/deepseek-ai/deepseek-math-7b-instruct`, // Model CF mungkin perlu update
                            { prompt: query },
                            { headers: { Authorization: `Bearer ${cloudflareKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
                        );
                        return res.data.result.response.replace("<think>", "").replace(/\*\*(.*?)\*\*/g, '*$1*');
                    }
                    throw new Error("Cloudflare AI credentials not configured");
                } catch (e4) {
                    console.error("All Deepseek attempts failed:", e4.message);
                    throw new Error("Gagal menghubungi layanan Deepseek setelah beberapa percobaan.");
                }
            }
        }
    }
}

async function geminiImage(text, image) {
    const apiUrl = `https://gemini-api-5k0h.onrender.com/gemini/image`;
    const params = { q: text, url: image };
    const response = await axios.get(apiUrl, { params, timeout: 25000 });
    return response.data.content || 'Gagal mendapatkan respons dari Gemini Image API.';
}

async function geminiText(prompt) {
    const apiUrl = `https://gemini-api-5k0h.onrender.com/gemini/chat`;
    const params = { q: prompt };
    const response = await axios.get(apiUrl, { params, timeout: 20000 });
    return response.data?.content || 'Gagal mendapatkan respons dari Gemini Text API.';
}

async function gpt4o(query) {
    const githubToken = process.env.GITHUB_AI_TOKEN_GPT4O; // Gunakan token spesifik jika ada, atau fallback
    if (!githubToken) throw new Error("Token GitHub AI untuk GPT-4o tidak dikonfigurasi.");
    const response = await axios.post('https://models.github.ai/inference/chat/completions',
        { messages: [{ role: 'system', content: '' }, { role: 'user', content: query }], temperature: 1, top_p: 1, model: 'openai/gpt-4o' }, // Cek model name yang valid
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${githubToken}` }, timeout: 30000 }
    );
    return response.data.choices[0].message.content;
}

async function gpt41(query) {
    const githubToken = process.env.GITHUB_AI_TOKEN_GPT41; // Gunakan token spesifik jika ada
    if (!githubToken) throw new Error("Token GitHub AI untuk GPT-4.1 tidak dikonfigurasi.");
    try {
        const res = await axios.post("https://models.github.ai/inference/chat/completions",
            { messages: [{ role: "system", content: "" }, { role: "user", content: query }], temperature: 1, top_p: 1, model: "openai/gpt-4-1106-preview" }, // Cek model name
            { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${githubToken}` }, timeout: 30000 }
        );
        return res.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
    } catch (e) {
        console.warn("GPT-4.1 main model failed, trying mini:", e.message);
        try {
            const res = await axios.post("https://models.github.ai/inference/chat/completions",
                { messages: [{ role: "system", content: "" }, { role: "user", content: query }], temperature: 1, top_p: 1, model: "openai/gpt-4-0613" }, // Cek model name mini
                { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${githubToken}` }, timeout: 30000 }
            );
            return res.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
        } catch (e2) {
            console.error("All GPT-4.1 attempts failed:", e2.message);
            throw new Error("Gagal menghubungi layanan GPT-4.1.");
        }
    }
}

async function googleSearchMojeek(query) {
    const res = await axios.get('https://www.mojeek.com/search', {
        params: { q: query },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36' },
        timeout: 10000
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('ul.results-standard li').each((_, el) => {
        const title = $(el).find('h2 a.title').text().trim();
        const url = $(el).find('a.ob').attr('href');
        const description = $(el).find('p.s').text().trim();
        if (title && url) results.push({ title, url, description });
    });
    if (results.length === 0) throw new Error("Tidak ada hasil pencarian ditemukan.");
    return results;
}

async function heroMLDetail(heroName) {
    const url = `https://mobile-legends.fandom.com/wiki/${encodeURIComponent(heroName.replace(/\s+/g, '_'))}`; // Pastikan format nama hero benar
    try {
        const { data } = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(data);
        const title = $('h1.page-header__title').text().trim();
        if (!title) throw new Error(`Hero "${heroName}" tidak ditemukan di Fandom.`);
        return {
            name: title,
            role: $('div[data-source="role"] .pi-data-value').text().trim() || 'N/A',
            speciality: $('div[data-source="specialty"] .pi-data-value').text().trim() || 'N/A',
            lane: $('div[data-source="lane"] .pi-data-value').text().trim() || 'N/A',
            price_bp: $('div[data-source="price"] .pi-data-value div:contains("Battle Points")').text().replace(/\D/g, '') || 'N/A',
            price_diamond: $('div[data-source="price"] .pi-data-value div:contains("Diamonds")').text().replace(/\D/g, '') || 'N/A',
            release_date: $('div[data-source="release_date"] .pi-data-value').text().trim() || 'N/A',
            image_url: $('.pi-image-thumbnail').attr('src') || null
        };
    } catch (e) {
        console.error('Gagal mengambil data HeroML:', e.message);
        throw new Error(e.message || `Gagal mengambil detail untuk hero ${heroName}.`);
    }
}

async function imageToAnimePixNova(imageUrl) {
    const WS_URL = "wss://pixnova.ai/demo-photo2anime/queue/join";
    const IMAGE_URL_PREFIX = "https://oss-global.pixnova.ai/";
    const SESSION_HASH = crypto.randomBytes(5).toString("hex").slice(0, 9);
    let wss, promiseResolver;

    function connectWebSocket(enableLog) {
        return new Promise((resolve, reject) => {
            wss = new WebSocket(WS_URL, [], { timeout: 10000 });
            wss.on("open", () => { if (enableLog) console.log("[PixNova] WebSocket Connected."); resolve(); });
            wss.on("error", e => { console.error("[PixNova] WebSocket Error:", e.message); reject(e); });
            wss.on("message", chunk => {
                const data = JSON.parse(chunk.toString());
                if (promiseResolver?.isOnce) { promiseResolver.resolve(data); promiseResolver = null; }
                else if (promiseResolver) {
                    if (enableLog) console.log("[PixNova] Message:", data);
                    if (data?.code === 200 && data?.success && data?.output?.result) {
                        data.output.result = data.output.result.map(x => IMAGE_URL_PREFIX + x);
                        promiseResolver.resolve(data);
                        promiseResolver = null;
                    } else if (data?.msg === "error") {
                        promiseResolver.reject(new Error(data?.error || "PixNova processing error"));
                        promiseResolver = null;
                    }
                }
            });
            wss.on("close", () => { if (enableLog) console.log("[PixNova] WebSocket Closed.")});
        });
    }

    function sendWebSocketPayload(payload, isOnce) {
        return new Promise((resolve, reject) => {
            wss.send(JSON.stringify(payload));
            promiseResolver = { resolve, reject, isOnce };
        });
    }

    let base64Image;
    if (isUrl(imageUrl)) {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 10000 });
        base64Image = Buffer.from(response.data).toString("base64");
    } else if (Buffer.isBuffer(imageUrl)) {
        base64Image = imageUrl.toString("base64");
    } else {
        throw new Error("Input harus berupa URL gambar atau Buffer gambar.");
    }

    await connectWebSocket(false);
    await sendWebSocketPayload({ session_hash: SESSION_HASH }, true);
    const result = await sendWebSocketPayload({
        data: {
            source_image: `data:image/jpeg;base64,${base64Image}`,
            strength: 0.65,
            prompt: "(masterpiece), (best quality), (anime style), vibrant colors, soft lighting, highly detailed, aesthetic background, dynamic composition, beautiful face, anime eyes, cinematic shading",
            negative_prompt: "(low quality:1.4), blurry, cropped, watermark, text, logo, extra fingers, extra limbs, bad anatomy, sketch, monochrome, grayscale",
            request_from: 2
        }
    }, false);
    if (wss && wss.readyState === WebSocket.OPEN) wss.close();
    return result;
}

async function imageToZombiePixNova(imageUrl) {
    const WS_URL = "wss://pixnova.ai/demo-photo2anime/queue/join"; // Endpoint sama dengan toAnime
    const IMAGE_URL_PREFIX = "https://oss-global.pixnova.ai/";
    const SESSION_HASH = crypto.randomBytes(5).toString("hex").slice(0, 9);
    let wss, promiseResolver;

    function connectWebSocket(enableLog) {
        return new Promise((resolve, reject) => {
            wss = new WebSocket(WS_URL, [], { timeout: 10000 });
            wss.on("open", () => { if (enableLog) console.log("[PixNova Zombie] WebSocket Connected."); resolve(); });
            wss.on("error", e => { console.error("[PixNova Zombie] WebSocket Error:", e.message); reject(e); });
            wss.on("message", chunk => {
                const data = JSON.parse(chunk.toString());
                if (promiseResolver?.isOnce) { promiseResolver.resolve(data); promiseResolver = null; }
                else if (promiseResolver) {
                    if (enableLog) console.log("[PixNova Zombie] Message:", data);
                    if (data?.code === 200 && data?.success && data?.output?.result) {
                        data.output.result = data.output.result.map(x => IMAGE_URL_PREFIX + x);
                        promiseResolver.resolve(data);
                        promiseResolver = null;
                    } else if (data?.msg === "error") {
                        promiseResolver.reject(new Error(data?.error || "PixNova Zombie processing error"));
                        promiseResolver = null;
                    }
                }
            });
             wss.on("close", () => { if (enableLog) console.log("[PixNova Zombie] WebSocket Closed.")});
        });
    }
    function sendWebSocketPayload(payload, isOnce) {
        return new Promise((resolve, reject) => {
            wss.send(JSON.stringify(payload));
            promiseResolver = { resolve, reject, isOnce };
        });
    }
    let base64Image;
    if (isUrl(imageUrl)) {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 10000 });
        base64Image = Buffer.from(response.data).toString("base64");
    } else if (Buffer.isBuffer(imageUrl)) {
        base64Image = imageUrl.toString("base64");
    } else {
        throw new Error("Input harus berupa URL gambar atau Buffer gambar.");
    }
    await connectWebSocket(false);
    await sendWebSocketPayload({ session_hash: SESSION_HASH }, true);
    const result = await sendWebSocketPayload({
        data: {
            source_image: `data:image/jpeg;base64,${base64Image}`,
            strength: 0.7,
            prompt: "zombie, undead, decayed face, horror, blood, rotting skin, glowing eyes, terrifying, apocalypse survivor, dark atmosphere, detailed horror art, cinematic lighting",
            negative_prompt: "cute, beautiful, clean face, low quality, blurry, watermark, cartoon, anime, sketch, colorful background",
            request_from: 2
        }
    }, false);
    if (wss && wss.readyState === WebSocket.OPEN) wss.close();
    return result;
}

async function igStalk(username) {
    const data = qs.stringify({ url: `@${username}` });
    const config = {
        method: 'POST',
        url: 'https://app.mailcamplly.com/api/instagram-profile',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://bitchipdigital.com/tools/social-media/instagram-profile-viewer/'
        },
        data,
        timeout: 15000
    };
    try {
        const res = await axios(config);
        if (res.data && res.data[0]) {
            let p = res.data[0];
            return {
                username: p.account || '',
                name: p.profile_name || '',
                followers: parseInt(p.followers) || 0,
                following: parseInt(p.followings) || 0, // Asumsi ada field followings
                posts: parseInt(p.posts) || 0,         // Asumsi ada field posts
                url: p.profile_url || '',
                profile_image_url: p.profile_image_link || '',
                is_private: p.is_private || false,      // Asumsi ada field is_private
                bio: p.biography || ''                // Asumsi ada field bio
            };
        }
        throw new Error('Data profil tidak ditemukan atau format respons tidak sesuai.');
    } catch (e) {
        console.error('igStalk Error:', e.message);
        throw new Error(e.response?.data?.error || e.message || 'Gagal mengambil data profil Instagram.');
    }
}

async function metaLlama(query) {
    const openRouterKey = process.env.OPENROUTER_API_KEY_LLAMA; // Ganti DENGAN ENV
    const groqKey = process.env.GROQ_API_KEY_LLAMA; // Ganti DENGAN ENV
    const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cloudflareKey = process.env.CLOUDFLARE_AI_TOKEN;

    try {
        if (openRouterKey) {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions',
                { model: "meta-llama/llama-3-8b-instruct:free", messages: [{ role: "user", content: query }] }, // Model Llama-3
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openRouterKey}` }, timeout: 20000 }
            );
            return response.data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
        }
        throw new Error("OpenRouter key for Llama not configured");
    } catch (e1) {
        console.warn("Meta Llama OpenRouter failed:", e1.message);
        try {
            if (groqKey) {
                const res = await axios.post("https://api.groq.com/openai/v1/chat/completions",
                    { messages: [{ role: "user", content: query }], model: "llama3-8b-8192", temperature: 0.7, max_tokens: 1024, top_p: 1, stream: false },
                    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` }, timeout: 20000 }
                );
                return res.data.choices[0]?.message?.content.replace(/\*\*(.*?)\*\*/g, '*$1*');
            }
            throw new Error("Groq API key for Llama not configured");
        } catch (e2) {
            console.warn("Meta Llama Groq failed:", e2.message);
            try {
                if (cloudflareId && cloudflareKey) {
                    const res = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/run/@cf/meta/llama-3-8b-instruct`,
                        { messages: [{ role: 'user', content: query }] }, // Cloudflare Llama-3 format
                        { headers: { Authorization: `Bearer ${cloudflareKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
                    );
                    return res.data.result.response.replace(/\*\*(.*?)\*\*/g, '*$1*');
                }
                throw new Error("Cloudflare AI credentials for Llama not configured");
            } catch (e3) {
                console.error("All Meta Llama attempts failed:", e3.message);
                throw new Error("Gagal menghubungi layanan Meta Llama setelah beberapa percobaan.");
            }
        }
    }
}

async function instagramDLSSS(url) {
    const secretKey = '19e08ff42f18559b51825685d917c5c9e9d89f8a5c1ab147f820f46e94c3df26'; // Tetap gunakan secret key jika memang dari sana
    let serverTime;
    try {
        const { data } = await axios.get('https://sssinstagram.com/msec', { timeout: 5000 });
        serverTime = Math.floor(data.msec * 1000);
    } catch {
        serverTime = Date.now();
    }

    const adjustedTime = Date.now() - (serverTime ? Date.now() - serverTime : 0);
    const raw = `${url}${adjustedTime}${secretKey}`;
    const signature = crypto.createHash('sha256').update(raw).digest('hex');

    const payload = { url, ts: adjustedTime, _ts: Date.now(), _s: signature }; // _ts bisa saja tidak relevan
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
        'Referer': 'https://sssinstagram.com/',
        'Origin': 'https://sssinstagram.com/'
    };
    try {
        const { data } = await axios.post('https://sssinstagram.com/api/convert', payload, { headers, timeout: 15000 });
        if (data && data.meta && data.items && data.items.length > 0) {
            return {
                title: data.meta.title,
                thumbnail: data.meta.thumbnail,
                duration: data.meta.duration,
                source: data.meta.source,
                medias: data.items.map(item => ({
                    url: item.url,
                    type: item.type, // video atau image
                    resolution: item.resolution, // jika video
                    size: item.size
                }))
            };
        }
        throw new Error(data.message || 'Gagal mengambil data dari SSSInstagram, format respons tidak sesuai.');
    } catch (err) {
        console.error("instagramDLSSS error:", err.message);
        throw new Error(err.response?.data?.message || err.message || 'Gagal mengambil data dari SSSInstagram.');
    }
}

async function geniusLyrics(title) {
    const searchUrl = `https://genius.com/api/search/song?q=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36' },
        timeout: 10000
    });

    const song = searchRes.data.response.sections[0]?.hits[0]?.result;
    if (!song || !song.url) throw new Error(`Lagu "${title}" tidak ditemukan di Genius.`);

    const lyricsRes = await axios.get(song.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36' },
        timeout: 10000
    });
    const $ = cheerio.load(lyricsRes.data);
    $('div[class*="Lyrics__Header-"], div[class*="Lyrics__Footer-"], div[class*="Lyrics__Billboard"], div[class*="Lyrics__Aside"], div[class*="Lyrics__ReleaseDate"], .rg_embed_body, .OUTBRAIN, .top_nft_collection').remove();
    let lyrics = "";
    $('div[class*="Lyrics__Container"], .lyrics, [data-lyrics-container="true"]').each((i, elem) => {
        $(elem).find('br').replaceWith('\n');
        $(elem).find('a').each((idx, anchor) => $(anchor).replaceWith($(anchor).text()));
        let rawText = $(elem).text();
        // Pembersihan lebih agresif
        rawText = rawText.replace(/\[.*?\]/g, match => `\n\n${match}\n`).replace(/\n{3,}/g, '\n\n').trim();
        lyrics += rawText + "\n\n";
    });
    
    lyrics = lyrics.replace(/\d+ ContributorsLyrics/i, '').replace(/Translations\w+/g, '').replace(/You might also like/gi,'').trim();
    if (!lyrics) throw new Error(`Tidak dapat mengekstrak lirik untuk "${song.title}".`);
    
    return {
        title: song.title,
        artist: song.primary_artist.name,
        genius_url: song.url,
        thumbnail_url: song.song_art_image_thumbnail_url || song.header_image_thumbnail_url,
        release_date: song.release_date_for_display,
        lyrics: lyrics.trim()
    };
}

const pxpicToolOptions = ['removebg', 'enhance', 'upscale', 'restore', 'colorize'];
const pxpicInternal = {
    upload: async (buffer, ext = 'png', mime = 'image/png') => {
        const fileName = Date.now() + "." + ext, folder = "uploads";
        const responsej = await axios.post("https://pxpic.com/getSignedUrl", { folder, fileName }, { headers: { "Content-Type": "application/json" }, timeout:10000 });
        const { presignedUrl } = responsej.data;
        await axios.put(presignedUrl, buffer, { headers: { "Content-Type": mime }, timeout: 15000 });
        return "https://files.fotoenhancer.com/uploads/" + fileName;
    },
    create: async (buffer, tool) => {
        if (!pxpicToolOptions.includes(tool)) throw new Error(`Tool tidak valid. Pilih dari: ${pxpicToolOptions.join(', ')}`);
        const imageUrl = await pxpicInternal.upload(buffer, 'png', 'image/png');
        let data = qs.stringify({
            imageUrl, targetFormat: 'png', needCompress: 'no', imageQuality: '100',
            compressLevel: '6', fileOriginalExtension: 'png', aiFunction: tool, upscalingLevel: (tool === 'upscale' ? '2' : '') // Level upscale default 2x jika toolnya upscale
        });
        const config = {
            method: 'POST',
            url: 'https://pxpic.com/callAiFunction',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'id-ID'
            },
            data,
            timeout: 30000 // Timeout lebih lama untuk AI processing
        };
        const api = await axios.request(config);
        if (api.data && api.data.resultImageUrl) return api.data.resultImageUrl;
        throw new Error(api.data.message || `Gagal memproses gambar dengan tool ${tool}.`);
    }
};
async function getBufferFromUrl(url, options = {}) {
  try {
    const res = await axios({ method: "get", url, headers: { DNT: 1, 'Upgrade-Insecure-Request': 1 }, ...options, responseType: 'arraybuffer', timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error("Error getting buffer from URL:", err.message);
    throw new Error(`Gagal mengambil buffer dari URL: ${url}`);
  }
}
async function imageEnhancementTool(imageUrl, tool) {
    const buffer = await getBufferFromUrl(imageUrl);
    return await pxpicInternal.create(buffer, tool);
}

async function pinterestSearch(query) {
    const base = "https://www.pinterest.com", searchPath = "/resource/BaseSearchResource/get/";
    const pinterestHeaders = {
        accept: 'application/json, text/javascript, */*, q=0.01',
        referer: base,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
        'x-app-version': '9.2.0', // Versi mungkin perlu diupdate
        'x-pinterest-appstate': 'active',
        'x-requested-with': 'XMLHttpRequest'
    };
    try {
        const { data: homePage } = await axios.get(base, { headers: pinterestHeaders, timeout: 10000 }); // Ambil cookies dulu
        const cookies = homePage.headers?.['set-cookie']?.map(c => c.split(';')[0].trim()).join('; ') || process.env.PINTEREST_COOKIES; // Fallback ke ENV jika gagal ambil otomatis
        
        if (!cookies) throw new Error("Gagal mendapatkan cookies Pinterest.");

        pinterestHeaders.cookie = cookies;
        // Header tambahan yang mungkin diperlukan dari observasi
        pinterestHeaders['x-pinterest-source-url'] = `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
        pinterestHeaders['x-csrftoken'] = cookies.match(/csrftoken=([a-zA-Z0-9]+);/)?.[1] || '';


        const params = {
            source_url: `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`,
            data: JSON.stringify({
                options: { isPrefetch: false, query, scope: "pins", bookmarks: [""], page_size: 25 }, // Page size bisa diatur
                context: {}
            }),
            _: Date.now()
        };
        const { data: searchData } = await axios.get(`${base}${searchPath}`, { headers: pinterestHeaders, params, timeout: 15000 });
        
        const results = searchData.resource_response.data.results
            .filter(v => v.images?.orig?.url)
            .map(v => ({
                id: v.id,
                title: v.title || v.grid_title || "",
                description: v.description || "",
                image_url: v.images.orig.url,
                board: v.board?.name || null,
                pinner: v.pinner ? { username: v.pinner.username, full_name: v.pinner.full_name } : null
            }));

        if (!results.length) throw new Error(`Tidak ada hasil ditemukan untuk "${query}" di Pinterest.`);
        return results;
    } catch (e) {
        console.error("Pinterest Search Error:", e.message);
        if (e.response) console.error("Pinterest Response Data:", e.response.data);
        throw new Error(e.response?.data?.resource_response?.message || e.message || "Gagal melakukan pencarian di Pinterest.");
    }
}
async function pinterestDL(url) {
    // Implementasi download langsung (jika berbeda dari search) bisa kompleks karena Pinterest sering mengubahnya.
    // Untuk sementara, bisa coba scrape halaman dan cari JSON data, atau gunakan hasil search jika itu link pin.
    // Kode dari file asli Anda untuk download spesifik URL mungkin lebih cocok di sini jika masih berfungsi.
    // Saya akan adaptasi dari kode Anda yang ada di pinterest.js
    try {
        const { data: html } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36" }, timeout: 10000 });
        const $ = cheerio.load(html);
        const videoSnippet = $('script[data-test-id="video-snippet"]');
        if (videoSnippet.length) {
            const videoData = JSON.parse(videoSnippet.html());
            if (videoData && videoData.contentUrl) {
                return {
                    type: 'video',
                    title: videoData.name || 'Video Pinterest',
                    uploader: videoData.creator?.name ? `@${videoData.creator.name}` : 'Unknown',
                    thumbnail_url: videoData.thumbnailUrl,
                    download_url: videoData.contentUrl,
                    duration: videoData.duration ? videoData.duration.replace('PT','').replace('M','.').replace('S','') + ' Menit' : 'N/A'
                };
            }
        }
        // Coba cari JSON dari data-relay-response
        const relayResponseScript = $("script[data-relay-response='true']");
        let imageData;
        relayResponseScript.each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                const pinData = json?.response?.data?.v3GetPinQuery?.data;
                if (pinData?.imageLargeUrl) {
                    imageData = {
                        type: 'image',
                        title: pinData.title || 'Gambar Pinterest',
                        uploader: pinData.pinner?.username ? `@${pinData.pinner.username}` : 'Unknown',
                        download_url: pinData.imageLargeUrl
                    };
                    return false; // Hentikan iterasi jika ditemukan
                }
            } catch (e) { /* Abaikan error parsing JSON */ }
        });
        if (imageData) return imageData;

        // Fallback jika tidak ada video snippet atau data relay yang cocok
        // Mencari gambar utama jika ada di meta tag atau elemen gambar besar
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
            return {
                type: 'image',
                title: $('meta[property="og:title"]').attr('content') || 'Gambar Pinterest',
                uploader: 'Unknown',
                download_url: ogImage
            };
        }
        throw new Error("Gagal mengekstrak media dari URL Pinterest.");
    } catch (e) {
        console.error("Pinterest DL Error:", e.message);
        throw new Error(e.message || "Gagal mengunduh dari Pinterest.");
    }
}

async function mediafireDL(url) {
    try {
        const res = await fetch(url, { headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout: 10000 });
        if (!res.ok) throw new Error(`Gagal fetch URL: ${res.status} ${res.statusText}`);
        const html = await res.text();
        const $ = cheerio.load(html);
        const downloadLink = $("a#downloadButton").attr("href");
        if (!downloadLink) throw new Error("Link download tidak ditemukan di halaman MediaFire.");
        const fileName = $("div.dl-btn-label").attr("title") || downloadLink.split("/").pop();
        const fileSizeText = $("div.dl-info > ul > li:nth-child(1) > span").text();
        const fileType = lookup(fileName) || 'application/octet-stream';

        return {
            filename: fileName,
            filesize: fileSizeText || 'N/A',
            filetype: fileType,
            download_url: downloadLink,
        };
    } catch (e) {
        console.error("MediaFire DL Error:", e.message);
        throw new Error(e.message || "Gagal mengambil data dari link MediaFire.");
    }
}

async function tiktokDL(url) {
    try {
        const response = await axios.post("https://www.tikwm.com/api/", null, { // Body bisa null jika semua parameter di URL
            params: { url: url, hd: 1 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' // Walaupun POST body null, header ini kadang dibutuhkan
            },
            timeout: 15000
        });
        if (response.data && response.data.code === 0 && response.data.data) {
            const data = response.data.data;
            return {
                title: data.title,
                author_name: data.author?.nickname,
                author_avatar: data.author?.avatar,
                cover_url: data.cover,
                duration: data.duration,
                video_nowm_url: data.play,
                video_hd_url: data.hdplay, // Jika ada
                music_url: data.music
            };
        }
        throw new Error(response.data.msg || "Gagal mengunduh video TikTok dari TikWM.");
    } catch (e) {
        console.error("TikTok DL Error:", e.message);
        if (e.response) console.error("TikTok DL Response:", e.response.data);
        throw new Error(e.response?.data?.msg || e.message || "Gagal mengunduh video TikTok.");
    }
}

async function textToImageOrg(prompt) {
    const BASE_URL = "https://www.texttoimage.org";
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
    };
    try {
        let translatedPrompt = prompt;
        try { // Coba translate ke English jika bukan English
            const { data: translationData } = await axios.get(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(prompt).replace(/%20/g, '+')}`, { timeout: 5000 }
            );
            if (translationData && translationData[0] && translationData[0][0] && translationData[0][0][0]) {
                translatedPrompt = translationData[0][0][0];
            }
        } catch (translateError) {
            console.warn("Gagal menerjemahkan prompt untuk text2img, menggunakan prompt asli:", translateError.message);
        }

        let q = new URLSearchParams({ prompt: translatedPrompt });
        let { data: generateData } = await axios.post(`${BASE_URL}/generate`, q, { headers, timeout: 20000 });
        if (!generateData || !generateData.url) throw new Error("Gagal mendapatkan URL hasil dari texttoimage.org/generate");

        let { data: htmlData } = await axios.get(`${BASE_URL}/${generateData.url}`, { headers, timeout: 10000 });
        const $ = cheerio.load(htmlData);
        let imageUrl = $(".image-container img").attr("src");
        if (!imageUrl) throw new Error("Gambar tidak ditemukan di halaman hasil texttoimage.org");

        return BASE_URL + imageUrl;
    } catch (e) {
        console.error("TextToImage.org Error:", e.message);
        if (e.response) console.error("TextToImage.org Response:", e.response.data);
        throw new Error(e.message || "Gagal membuat gambar dari teks.");
    }
}

async function whisperTranscribe(audioUrl) {
    const groqApiKey = process.env.GROQ_API_KEY_WHISPER; // GANTI DENGAN ENV
    if (!groqApiKey) throw new Error("Kunci API Groq untuk Whisper tidak dikonfigurasi.");
    try {
        const audioBuffer = await getBufferFromUrl(audioUrl);
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' }); // Asumsi mp3, bisa lebih dinamis
        form.append('model', 'whisper-large-v3');

        const { data } = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${groqApiKey}` },
            timeout: 60000 // Transkripsi bisa lama
        });
        if (!data || !data.text) throw new Error("Gagal mendapatkan teks transkripsi dari Groq Whisper.");
        return data.text;
    } catch (error) {
        console.error('Whisper Transcribe Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || error.message || 'Gagal melakukan transkripsi audio.');
    }
}

async function youtubeDownloadSavetube(link, format) {
    const api = { base: "https://media.savetube.me/api", cdn: "/random-cdn", info: "/v2/info", download: "/download" };
    const savetubeHeaders = {
        accept: "*/*", "content-type": "application/json", origin: "https://yt.savetube.me",
        referer: "https://yt.savetube.me/", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    };
    const formatVideo = ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p", "2k", "4k", "8k"]; // Tambahkan 'p'
    const formatAudio = ["mp3", "m4a", "webm", "aac", "flac", "opus", "ogg", "wav"];

    const hexToBuffer = (hex) => Buffer.from(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))); // Perbaikan hexToBuffer
    const decrypt = async (enc) => {
        const key = hexToBuffer("C5D58EF67A7584E4A29F6C35BBC4EB12");
        const data = Buffer.from(enc, "base64"), iv = data.slice(0, 16), content = data.slice(16);
        const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    };
    const youtubeIdExtractor = (url) => {
        if (!url) return null;
        const patterns = [ /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/ ];
        for (const pattern of patterns) if (pattern.test(url)) return url.match(pattern)[1];
        return null;
    };
    const requestApi = async (endpoint, data = {}, method = "post") => {
        try {
            const res = await axios({ method, url: `${endpoint.startsWith("http") ? "" : api.base}${endpoint}`, data: method === "post" ? data : undefined, params: method === "get" ? data : undefined, headers: savetubeHeaders, timeout: 15000 });
            return { status: true, code: 200, data: res.data };
        } catch (error) {
            return { status: false, code: error.response?.status || 500, error: error.message, responseData: error.response?.data };
        }
    };
    const getCdnUrl = async () => {
        const response = await requestApi(api.cdn, {}, "get");
        if (!response.status || !response.data.cdn) throw new Error(response.responseData?.message || response.error || "Gagal mendapatkan CDN Savetube.");
        return response.data.cdn;
    };

    if (!link) throw new Error("Parameter URL YouTube diperlukan.");
    if (!isUrl(link)) throw new Error("URL YouTube tidak valid.");
    const videoId = youtubeIdExtractor(link);
    if (!videoId) throw new Error("Gagal mengekstrak ID video dari URL YouTube.");

    const allFormats = [...formatVideo, ...formatAudio];
    const requestedFormat = format ? format.toLowerCase() : (formatAudio.includes('mp3') ? 'mp3' : '720p'); // Default ke mp3 atau 720p
    if (!allFormats.includes(requestedFormat)) throw new Error(`Format tidak valid. Pilihan: ${allFormats.join(', ')}`);
    
    const cdn = await getCdnUrl();
    const infoResult = await requestApi(`https://${cdn}${api.info}`, { url: `https://www.youtube.com/watch?v=${videoId}` });
    if (!infoResult.status || !infoResult.data.data) throw new Error(infoResult.responseData?.message || infoResult.error || "Gagal mendapatkan info video dari Savetube.");
    
    const decryptedInfo = await decrypt(infoResult.data.data);
    if (!decryptedInfo || !decryptedInfo.key) throw new Error("Gagal mendekripsi info video.");

    const downloadResult = await requestApi(`https://${cdn}${api.download}`, {
        id: videoId, 
        downloadType: formatAudio.includes(requestedFormat) ? "audio" : "video", 
        quality: formatAudio.includes(requestedFormat) ? "128" : requestedFormat.replace('p',''), // Hapus 'p' untuk kualitas video
        key: decryptedInfo.key
    });
    if (!downloadResult.status || !downloadResult.data.data || !downloadResult.data.data.downloadUrl) {
        throw new Error(downloadResult.responseData?.message || downloadResult.error || "Gagal mendapatkan link download dari Savetube.");
    }
    const timeFormat = (v) => {
        let sec = parseInt(v, 10); if (isNaN(sec)) return 'N/A';
        let h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return (h ? (h < 10 ? "0" + h : h) + ":" : "") + (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    };
    return {
        title: decryptedInfo.title || "Video YouTube",
        video_id: videoId,
        duration_formatted: timeFormat(decryptedInfo.duration),
        duration_seconds: parseInt(decryptedInfo.duration) || 0,
        thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        requested_format: requestedFormat,
        download_url: downloadResult.data.data.downloadUrl,
    };
}


async function twitterDL(url) {
    try {
        const { data } = await axios.post("https://twmate.com/action", new URLSearchParams({ url }), { // Endpoint action lebih umum
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Accept: "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
                Referer: "https://twmate.com/",
            },
            timeout: 15000
        });
        if (data.status !== 'success' || !data.result) throw new Error(data.message || "Gagal mengambil data dari TwMate.");

        const $ = cheerio.load(data.result); // Data.result berisi HTML
        const videoLinks = [];
        const imageLinks = [];
        const authorName = $('div.info > div > p > strong').text().trim();
        const authorUsername = $('div.info > div > p > small').text().trim();
        const caption = $('div.info > div > p:nth-child(2)').text().trim();


        $('div.button-group > a.btn-dl').each((i, e) => {
            const qualityText = $(e).text().trim(); // "Download 720p", "Download GIF", "Download MP3"
            const downloadUrl = $(e).attr("href");
            
            if (downloadUrl.includes(".mp4")) {
                const qualityMatch = qualityText.match(/(\d+p)/i);
                videoLinks.push({ quality: qualityMatch ? qualityMatch[1] : 'Unknown', url: downloadUrl });
            } else if (qualityText.toLowerCase().includes('gambar') || downloadUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
                 imageLinks.push({ url: downloadUrl });
            }
        });
        
        if (videoLinks.length > 0) {
            return { type: 'video', author_name: authorName, author_username: authorUsername, caption, medias: videoLinks };
        } else if (imageLinks.length > 0) {
            return { type: 'image', author_name: authorName, author_username: authorUsername, caption, medias: imageLinks };
        }
        throw new Error("Tidak ada media yang dapat diunduh ditemukan dari TwMate.");
    } catch (error) {
        console.error("Twitter DL Error:", error.message);
        if (error.response) console.error("Twitter DL Response:", error.response.data);
        throw new Error(error.response?.data?.message || error.message || "Gagal mengunduh dari Twitter.");
    }
}

async function ytmp4Mobi(youtubeUrl) { // ytmp3mobi diganti jadi ytmp4Mobi untuk MP4
    const regYoutubeId = /https:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|m\.youtube\.com\/watch\?v=)([^&|^?]+)/;
    const videoId = youtubeUrl.match(regYoutubeId)?.[1]; // Ambil grup ke-1
    if (!videoId) throw Error("Tidak dapat mengekstrak ID video YouTube dari link yang diberikan.");

    const urlParam = { v: videoId, f: "mp4", _: Math.random().toString(36).substring(7) };
    const headers = { "Referer": "https://id.ytmp3.mobi/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

    const fetchJson = async (url, fetchDescription) => {
        const res = await fetch(url, { headers, timeout: 10000 }); // fetch dari undici
        if (!res.ok) throw Error(`Fetch gagal pada ${fetchDescription} | ${res.status} ${res.statusText}`);
        return await res.json();
    };

    const { convertURL } = await fetchJson("https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=" + Math.random().toString(36).substring(7), "get convertURL");
    if (!convertURL) throw new Error("Gagal mendapatkan convertURL dari ytmp3.mobi");

    const { progressURL, downloadURL: initialDownloadURL, title: initialTitle } = await fetchJson(`${convertURL}&${new URLSearchParams(urlParam).toString()}`, "get progressURL and downloadURL");
    if (!progressURL) throw new Error("Gagal mendapatkan progressURL dari ytmp3.mobi");

    let error, progress, title = initialTitle, finalDownloadURL = initialDownloadURL;
    let attempts = 0;
    const maxAttempts = 20; // Batas percobaan polling

    while (progress != 3 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Jeda polling
        const progressData = await fetchJson(progressURL, "fetch progressURL");
        error = progressData.error;
        progress = progressData.progress;
        title = progressData.title || title; // Update title jika ada
        finalDownloadURL = progressData.downloadURL || finalDownloadURL; // Update downloadURL jika ada

        if (error) throw Error(`Error dari ytmp3.mobi saat proses: ${error}`);
        // console.log(`[ytmp4Mobi] Status: ${progress}, Title: ${title}`);
        attempts++;
    }
    if (progress != 3) throw new Error("Gagal mengkonversi video setelah beberapa percobaan.");

    return { title, download_url: finalDownloadURL };
}

async function spotifyDLSpotyflyer(url) {
    if (!/open\.spotify\.com\/(track|album|playlist|artist)/.test(url)) {
        throw new Error("URL Spotify tidak valid.");
    }
    try {
        const list = await axios.post("https://api.spotifydown.com/metadata", new URLSearchParams({ url }), {
          headers: { Origin: "https://spotifydown.com", Referer: "https://spotifydown.com/" },
        });
        const link = await axios.post("https://api.spotifydown.com/download", new URLSearchParams({ id: list.data.id }), {
          headers: { Origin: "https://spotifydown.com", Referer: "https://spotifydown.com/" },
        });
        const result = {
          title: list.data.title,
          artis: list.data.artists,
          album: list.data.album,
          rilis: list.data.releaseDate,
          image: list.data.cover,
          url: link.data.link,
        };
        return result
    } catch (e) {
        console.error("SpotifyDL Spotyflyer Error:", e.message);
        if (e.response) console.error("SpotifyDL Spotyflyer Response:", e.response.data);
        throw new Error(e.response?.data?.message || e.message || "Gagal mengunduh dari Spotify (Spotyflyer).");
    }
}

async function douyinDownloadLovetik(url) {
    const apiUrl = "https://lovetik.app/api/ajaxSearch";
    const formData = new URLSearchParams();
    formData.append("q", url);
    formData.append("lang", "id"); // Bisa jadi parameter opsional

    const response = await axios.post(apiUrl, formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Origin": "https://lovetik.app",
        "Referer": "https://lovetik.app/"
      },
      timeout: 15000
    });

    const data = response.data;
    if (data.status !== "ok" || !data.data) throw new Error(data.mess || "Gagal mengambil data Douyin dari Lovetik.");
    
    const $ = cheerio.load(data.data); // data.data berisi HTML
    const title = $("h3").text().trim();
    const thumbnail = $(".image-tik img").attr("src");
    // const duration = $(".content p").text(); // Tidak selalu ada atau akurat
    const links = [];

    $(".dl-action a").each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const downloadUrl = $(el).attr("href");
      if (downloadUrl) {
        let type = 'video';
        if (text.includes('watermark')) type = 'video_watermark';
        else if (text.includes('mp3') || text.includes('audio')) type = 'audio';
        links.push({ type, quality: text.replace('download','').replace('tanpa watermark','').replace('dengan watermark','').trim(), url: downloadUrl });
      }
    });
    if (links.length === 0) throw new Error("Tidak ada link unduhan yang ditemukan.");

    return { title, thumbnail_url: thumbnail, download_links: links };
}

class DouyinSearchClient {
    constructor() {
        this.baseURL = 'https://www.douyin.com/'; // Ganti ke douyin.com
        this.cookies = {};
        this.defaultSearchParams = {
            // Parameter search douyin.com bisa berbeda, perlu riset
            // Contoh: search_source: 'normal_search', query_correct_type: '1'
            // Mungkin juga perlu `msToken` dan signature seperti `X-Bogus` atau `_signature`
            device_platform: 'webapp',
            aid: '6383', // Contoh aid untuk webapp
            // channel, sec_user_id, etc. mungkin diperlukan
        };
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Accept': 'application/json, text/plain, */*', // Minta JSON jika memungkinkan
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Referer': 'https://www.douyin.com/',
            }
        });

        this.api.interceptors.response.use(res => {
            const setCookies = res.headers['set-cookie'];
            if (setCookies) setCookies.forEach(c => {
                const [name, value] = c.split(';')[0].split('=');
                if (name && value) this.cookies[name] = value;
            });
            return res;
        });
        this.api.interceptors.request.use(config => {
            if (Object.keys(this.cookies).length) {
                config.headers['Cookie'] = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
            }
            // Mungkin perlu menambahkan msToken dan signature di sini jika sudah didapatkan
            return config;
        });
    }

    async initialize() { // Untuk mendapatkan cookies awal dan mungkin msToken
        try {
            await this.api.get('/'); // Kunjugi halaman utama
            // Cari msToken jika ada di HTML atau dari endpoint khusus
            // const { data: homeHtml } = await this.api.get('/');
            // const $ = cheerio.load(homeHtml);
            // const msTokenMatch = homeHtml.match(/"msToken"\s*:\s*"([^"]+)"/);
            // if (msTokenMatch && msTokenMatch[1]) this.msToken = msTokenMatch[1];
            return true;
        } catch { return false; }
    }

    async search(query, count = 10) {
        await this.initialize();
        // Endpoint search Douyin sebenarnya: /aweme/v1/web/search/item/ atau /aweme/v1/web/discover/search/
        // Ini memerlukan parameter yang kompleks termasuk signature (`_signature` atau `X-Bogus`)
        // Scraper yang ada di file asli menggunakan `so.douyin.com` yang mungkin lebih mudah di-scrape HTML-nya.
        // Jika menggunakan so.douyin.com dari file asli:
        try {
            const soApi = axios.create({baseURL: 'https://so.douyin.com/' , headers: this.api.defaults.headers});
            if (Object.keys(this.cookies).length) soApi.defaults.headers['Cookie'] = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

            const res = await soApi.get('search/video/', { // Sesuaikan path jika perlu
                params: { keyword: query, // Tambahkan parameter lain jika diketahui dari observasi
                          offset: 0, count: count, source: 'search_history', search_id: crypto.randomUUID()
                         }
            });
            // Parsing HTML dari so.douyin.com seperti di file asli
            // const $ = cheerio.load(res.data);
            // let scriptWithData = '';
            // $('script').each((_, el) => {
            //   const t = $(el).html();
            //   if (t && t.includes('window._SSR_DATA') && t.includes('aweme_list')) scriptWithData = t; // atau pola data lain
            // });
            // const match = scriptWithData.match(/window\._SSR_DATA\s*=\s*(\{[\s\S]+?\});/);
            // if (!match || !match[1]) throw new Error('Data SSR tidak ditemukan di so.douyin.com');
            // const ssrData = JSON.parse(match[1]);
            // const awemeList = ssrData?.data?.[0]?.data?.aweme_list; // Path data bisa berbeda

            // Ini adalah contoh jika API search Douyin langsung mengembalikan JSON:
            if (res.data && Array.isArray(res.data.data)) { // Sesuaikan path data aktual
                 return res.data.data.map(item => ({ // Sesuaikan mapping field
                    aweme_id: item.aweme_id,
                    desc: item.desc,
                    create_time: item.create_time,
                    author: {
                        uid: item.author?.uid,
                        nickname: item.author?.nickname,
                        avatar_thumb: item.author?.avatar_thumb?.url_list?.[0]
                    },
                    video: {
                        play_addr: item.video?.play_addr?.url_list?.[0],
                        cover: item.video?.cover?.url_list?.[0],
                        height: item.video?.height,
                        width: item.video?.width,
                        duration: item.video?.duration
                    },
                    statistics: item.statistics
                })).filter(Boolean);
            }
            throw new Error('Format respons pencarian Douyin tidak dikenali atau tidak ada hasil.');

        } catch (e) {
            console.error("Douyin Search Error:", e.message);
            throw e;
        }
    }
}


const BstationClient = { // Mengubah class menjadi object literal
    search: async function (q) {
        let { data } = await axios.get(`https://www.bilibili.tv/id/search-result?q=${encodeURIComponent(q)}`, { timeout: 10000 })
            .catch((e) => { throw e.response || e; });
        let $ = cheerio.load(data);
        let result = [];
        $(".bstar-video-card").each((index, element) => { // Selector lebih umum
            const textWrap = $(element).find(".bstar-video-card__text-wrap");
            const coverWrap = $(element).find(".bstar-video-card__cover-wrap");

            const videoTitle = textWrap.find(".bstar-video-card__title-text").text().trim();
            if (!videoTitle) return; // Lewati jika tidak ada judul

            const videoLink = $(element).find("a.bstar-video-card__title-wrap, a.bstar-video-card__cover-wrap").attr("href");
            const videoThumbnail = coverWrap.find("img.bstar-image__img").attr("src");
            const videoDuration = coverWrap.find(".bstar-video-card__duration-text").text().trim(); // Selector durasi diperbarui
            
            const userName = textWrap.find(".bstar-video-card__nickname-text").text().trim(); // Selector nickname diperbarui
            const userAvatar = $(element).closest('.bstar-card').find('.bstar-up-card__face img.bstar-image__img').attr('src') || textWrap.prev('.bstar-card__author-wrap').find('img.bstar-image__img').attr('src'); // Mencoba beberapa selector avatar
            const videoViews = textWrap.find(".bstar-video-card__desc-text").first().text().trim(); // Selector views diperbarui

            result.push({
                title: videoTitle,
                views: videoViews,
                url: videoLink ? (videoLink.startsWith('http') ? videoLink : "https://www.bilibili.tv" + videoLink) : null,
                thumbnail_url: videoThumbnail,
                duration: videoDuration,
                author: { name: userName, avatar_url: userAvatar }
            });
        });
        if (result.length === 0) throw new Error("Tidak ada hasil pencarian Bstation ditemukan.");
        return result;
    },
    download: async function (url) {
        try {
            if (!isUrl(url) || !url.includes("bilibili.tv/id/video/")) throw new Error("URL video Bstation tidak valid.");
            // const aidMatch = url.match(/\/video\/(\d+)/);
            // if (!aidMatch || !aidMatch[1]) throw new Error("Gagal mengekstrak ID video dari URL.");
            // const aid = aidMatch[1];

            // Menggunakan blahaj.ca seperti di kode asli, tapi ini bisa tidak stabil
            let { data: blahajData } = await axios.post("https://c.blahaj.ca/", { url: url }, {
                headers: { Accept: "application/json", "Content-type": "application/json" },
                timeout: 15000
            }).catch((e) => { throw e.response || e; });

            if (!blahajData || !blahajData.url) throw new Error("Gagal mendapatkan link download dari layanan eksternal.");

            // Scrape metadata tambahan dari halaman Bstation
            const { data: pageHtml } = await axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(pageHtml);
            const title = $('meta[property="og:title"]').attr("content")?.split("|")[0].trim() || $('h1.video-title').text().trim() || blahajData.filename?.replace(/\.[^/.]+$/, "") || "Video Bstation";
            const cover = $('meta[property="og:image"]').attr("content");
            const description = $('meta[property="og:description"]').attr("content");
            
            return {
                title: title,
                thumbnail_url: cover,
                description: description,
                download_url: blahajData.url,
                filename: blahajData.filename,
                type: lookup(blahajData.filename) || 'video/mp4'
            };
        } catch (e) {
            console.error("Bstation Download Error:", e.message);
            throw e;
        }
    }
};


async function genshinStalk(uid) {
    if (!/^\d{9}$/.test(uid)) throw new Error("UID Genshin Impact tidak valid (harus 9 digit angka).");
    const url = `https://enka.network/api/uid/${uid}/`; // Tambahkan trailing slash
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36' },
            timeout: 15000
        });

        if (!data || !data.playerInfo) throw new Error('Data pemain tidak ditemukan di Enka.Network atau UID salah.');

        const { playerInfo, avatarInfoList } = data; // avatarInfoList mungkin lebih akurat daripada showAvatarInfoList
        const charactersInShowcase = playerInfo.showAvatarInfoList || []; // Karakter di showcase
        const allPlayerCharacters = avatarInfoList || []; // Semua karakter yang dimiliki (jika API menyediakan)

        const mapCharacter = (char) => ({
            id: char.avatarId,
            // name: characterMap[char.avatarId] || `Unknown (${char.avatarId})`, // characterMap perlu didefinisikan global atau di pass
            level: char.level,
            costume_id: char.costumeId || null,
            // Tambahkan info lain jika perlu dari `char` object
        });

        return {
            uid: data.uid,
            nickname: playerInfo.nickname,
            level: playerInfo.level,
            signature: playerInfo.signature || "",
            world_level: playerInfo.worldLevel || 0,
            namecard_id: playerInfo.nameCardId,
            achievement_count: playerInfo.finishAchievementNum || 0,
            tower_floor_index: playerInfo.towerFloorIndex || 0, // Spiral Abyss Floor
            tower_level_index: playerInfo.towerLevelIndex || 0, // Spiral Abyss Chamber
            profile_picture: { // Info dari profilePicture lebih detail
                id: playerInfo.profilePicture?.avatarId,
                 name: characterMap[playerInfo.profilePicture?.avatarId] || `Unknown (${playerInfo.profilePicture?.avatarId})`
            },
            showcase_characters: charactersInShowcase.map(mapCharacter),
             all_characters: allPlayerCharacters.map(mapCharacter)
        };
    } catch (e) {
        console.error("Genshin Stalk Error:", e.message);
        if (e.response && e.response.status === 404) throw new Error(`UID ${uid} tidak ditemukan atau profil disembunyikan.`);
        if (e.response && e.response.status === 400) throw new Error(`Permintaan ke Enka.Network tidak valid (mungkin UID salah format).`);
        throw new Error(e.message || "Gagal mengambil data dari Enka.Network.");
    }
}


module.exports = {
    isUrl,
    hydromind,
    luminaiFetchContent,
    deepseekAI,
    geminiImage,
    geminiText,
    gpt4o,
    gpt41,
    googleSearchMojeek,
    heroMLDetail,
    imageToAnimePixNova,
    imageToZombiePixNova,
    igStalk,
    metaLlama,
    instagramDLSSS,
    geniusLyrics,
    imageEnhancementTool, 
    pxpicToolOptions,     
    pinterestSearch,
    pinterestDL,
    mediafireDL,
    tiktokDL,
    textToImageOrg,
    whisperTranscribe,
    youtubeDownloadSavetube, 
    twitterDL,
    ytmp4Mobi,
    spotifyDLSpotyflyer,
    douyinDownloadLovetik,
    DouyinSearchClient,
    BstationClient      
};