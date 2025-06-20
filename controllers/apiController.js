const scrapers = require('../helpers/scrapers');
exports.getExampleData = (req, res) => {
    res.json({
        success: true,
        message: "Ini adalah data contoh dari Wanzofc API!",
        requestedBy: req.userContext.username,
        timestamp: new Date().toISOString(),
        data: { id: 1, name: "Contoh Item", value: Math.random() * 100 }
    });
};

async function handleScraper(req, res, scraperFunction, queryParams, paramNames) {
    const missingParams = [];
    const params = {};

    paramNames.forEach(p => {
        const paramValue = req.query[p.queryName || p.name];
        if (p.required && !paramValue) {
            missingParams.push(p.label || p.name);
        }
        if (paramValue !== undefined) { // Kirim parameter jika ada, termasuk string kosong jika memang dikirim
            params[p.name] = paramValue;
        } else if (p.default !== undefined) { // Gunakan default jika ada dan parameter tidak dikirim
            params[p.name] = p.default;
        }
    });

    if (missingParams.length > 0) {
        return res.status(400).json({ success: false, message: `Parameter berikut diperlukan: ${missingParams.join(', ')}.` });
    }

    try {
        const result = await scraperFunction(...Object.values(params)); // Panggil fungsi dengan argumen sesuai urutan di paramNames
        res.json({ success: true, requestedBy: req.userContext.username, query: params, result });
    } catch (error) {
        console.error(`API Error (${scraperFunction.name}) User: ${req.userContext.username}, Params: ${JSON.stringify(params)}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan pada server.' });
    }
}

exports.aiHydromind = (req, res) => handleScraper(req, res, scrapers.hydromind, req.query, [{ name: 'content', required: true, label: 'Teks/Konten' }, { name: 'model', required: true, label: 'Model AI' }]);
exports.aiLuminai = (req, res) => handleScraper(req, res, scrapers.luminaiFetchContent, req.query, [{ name: 'content', queryName: 'text', required: true, label: 'Teks/Konten' }]);
exports.aiDeepseek = (req, res) => handleScraper(req, res, scrapers.deepseekAI, req.query, [{ name: 'query', queryName: 'prompt', required: true, label: 'Prompt' }]);
exports.aiGeminiImage = (req, res) => handleScraper(req, res, scrapers.geminiImage, req.query, [{ name: 'text', queryName: 'prompt', required: true, label: 'Prompt Teks' }, { name: 'image', queryName: 'url', required: true, label: 'URL Gambar' }]);
exports.aiGeminiText = (req, res) => handleScraper(req, res, scrapers.geminiText, req.query, [{ name: 'prompt', required: true, label: 'Prompt' }]);
exports.aiGpt4o = (req, res) => handleScraper(req, res, scrapers.gpt4o, req.query, [{ name: 'query', queryName: 'prompt', required: true, label: 'Prompt' }]);
exports.aiGpt41 = (req, res) => handleScraper(req, res, scrapers.gpt41, req.query, [{ name: 'query', queryName: 'prompt', required: true, label: 'Prompt' }]);
exports.aiMetaLlama = (req, res) => handleScraper(req, res, scrapers.metaLlama, req.query, [{ name: 'query', queryName: 'prompt', required: true, label: 'Prompt' }]);
exports.aiTextToImageOrg = (req, res) => handleScraper(req, res, scrapers.textToImageOrg, req.query, [{ name: 'prompt', required: true, label: 'Prompt' }]);
exports.aiWhisperTranscribe = (req, res) => handleScraper(req, res, scrapers.whisperTranscribe, req.query, [{ name: 'audioUrl', queryName: 'url', required: true, label: 'URL Audio' }]);

exports.downloaderYouTube = (req, res) => handleScraper(req, res, scrapers.youtubeDownloadSavetube, req.query, [{ name: 'link', queryName: 'url', required: true, label: 'URL YouTube' }, { name: 'format', required: false, label: 'Format (opsional)', default: '720p' }]);
exports.downloaderYouTubeMp4Mobi = (req, res) => handleScraper(req, res, scrapers.ytmp4Mobi, req.query, [{ name: 'youtubeUrl', queryName: 'url', required: true, label: 'URL YouTube' }]);
exports.downloaderInstagram = (req, res) => handleScraper(req, res, scrapers.instagramDLSSS, req.query, [{ name: 'url', required: true, label: 'URL Instagram' }]);
exports.downloaderTikTok = (req, res) => handleScraper(req, res, scrapers.tiktokDL, req.query, [{ name: 'url', required: true, label: 'URL TikTok' }]);
exports.downloaderTwitter = (req, res) => handleScraper(req, res, scrapers.twitterDL, req.query, [{ name: 'url', required: true, label: 'URL Twitter/X' }]);
exports.downloaderMediaFire = (req, res) => handleScraper(req, res, scrapers.mediafireDL, req.query, [{ name: 'url', required: true, label: 'URL MediaFire' }]);
exports.downloaderSpotify = (req, res) => handleScraper(req, res, scrapers.spotifyDLSpotyflyer, req.query, [{ name: 'url', required: true, label: 'URL Spotify' }]);
exports.downloaderDouyin = async (req, res) => { // Douyin butuh perlakuan khusus karena ada search vs download
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: "Parameter 'url' (untuk download) atau 'query' (untuk search) diperlukan." });
    try {
        let result;
        if (scrapers.isUrl(url)) {
            result = await scrapers.douyinDownloadLovetik(url);
        } else {
            const searcher = new scrapers.DouyinSearchClient();
            result = await searcher.search(url);
        }
        res.json({ success: true, requestedBy: req.userContext.username, query_or_url: url, result });
    } catch (error) {
        console.error(`API Error (Douyin) User: ${req.userContext.username}, Query/URL: ${url}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || 'Gagal memproses permintaan Douyin.' });
    }
};
exports.downloaderBstation = async (req, res) => { // Bstation juga
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: "Parameter 'query' (URL video atau kata kunci pencarian) diperlukan." });
    try {
        let result;
        if (scrapers.isUrl(query) && query.includes('bilibili.tv/id/video/')) {
            result = await scrapers.BstationClient.download(query);
        } else {
            result = await scrapers.BstationClient.search(query);
        }
        res.json({ success: true, requestedBy: req.userContext.username, query_input: query, result });
    } catch (error) {
        console.error(`API Error (Bstation) User: ${req.userContext.username}, Query: ${query}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || 'Gagal memproses permintaan Bstation.' });
    }
};

exports.searchGoogle = (req, res) => handleScraper(req, res, scrapers.googleSearchMojeek, req.query, [{ name: 'query', queryName: 'q', required: true, label: 'Kata Kunci Pencarian' }]);
exports.searchPinterest = (req, res) => handleScraper(req, res, scrapers.pinterestSearch, req.query, [{ name: 'query', required: true, label: 'Kata Kunci Pencarian' }]);
exports.searchGeniusLyrics = (req, res) => handleScraper(req, res, scrapers.geniusLyrics, req.query, [{ name: 'title', queryName: 'q', required: true, label: 'Judul Lagu/Artis' }]);


exports.stalkInstagram = (req, res) => handleScraper(req, res, scrapers.igStalk, req.query, [{ name: 'username', queryName: 'q', required: true, label: 'Username Instagram' }]);
exports.stalkGenshin = (req, res) => handleScraper(req, res, scrapers.genshinStalk, req.query, [{ name: 'uid', queryName: 'q', required: true, label: 'UID Genshin Impact' }]);


exports.toolsImageToAnime = (req, res) => handleScraper(req, res, scrapers.imageToAnimePixNova, req.query, [{ name: 'imageUrl', queryName: 'url', required: true, label: 'URL Gambar' }]);
exports.toolsImageToZombie = (req, res) => handleScraper(req, res, scrapers.imageToZombiePixNova, req.query, [{ name: 'imageUrl', queryName: 'url', required: true, label: 'URL Gambar' }]);
exports.toolsImageEnhancement = async (req, res) => { // Perlu parameter 'tool'
    const { url, tool } = req.query;
    if (!url) return res.status(400).json({ success: false, message: "Parameter 'url' diperlukan." });
    if (!tool || !scrapers.pxpicToolOptions.includes(tool.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Parameter 'tool' tidak valid. Pilihan: ${scrapers.pxpicToolOptions.join(', ')}.` });
    }
    try {
        const resultImageUrl = await scrapers.imageEnhancementTool(url, tool.toLowerCase());
        res.json({ success: true, requestedBy: req.userContext.username, query: { url, tool }, result: { enhanced_image_url: resultImageUrl } });
    } catch (error) {
        console.error(`API Error (ImageEnhance/${tool}) User: ${req.userContext.username}, URL: ${url}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || `Gagal memproses gambar dengan tool ${tool}.` });
    }
};
exports.toolsHeroMLDetail = (req, res) => handleScraper(req, res, scrapers.heroMLDetail, req.query, [{ name: 'heroName', queryName: 'q', required: true, label: 'Nama Hero Mobile Legends' }]);

exports.scrapeTextToVideo = async (req, res) => { // Ini dari contoh sebelumnya, pastikan txt2video ada di scrapers.js
    const { prompt } = req.query;
    if (!prompt) return res.status(400).json({ success: false, message: 'Parameter "prompt" diperlukan.'});
    try {
        const videoUrl = await scrapers.txt2video(prompt); // Panggil dari scrapers
        res.json({ success: true, requestedBy: req.userContext.username, prompt: prompt, result: { video_url: videoUrl } });
    } catch (error) {
        console.error(`API Error (txt2video) User: ${req.userContext.username}, Prompt: ${prompt}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || 'Gagal memproses permintaan text-to-video.' });
    }
};
exports.scrapeGrowAGarden = async (req, res) => { 
    try {
        const stockData = await scrapers.growagarden(); 
        res.json({ success: true, requestedBy: req.userContext.username, result: stockData });
    } catch (error) {
        console.error(`API Error (growagarden) User: ${req.userContext.username}, Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message || 'Gagal mengambil data Grow A Garden.' });
    }
};