const express = require('express');
const router = express.Router();
const { checkApiKey, apiRateLimiter } = require('../middleware/apiKeyMiddleware');
const apiController = require('../controllers/apiController');

router.get('/example', checkApiKey, apiRateLimiter, apiController.getExampleData);

// AI Endpoints
router.get('/ai/hydromind', checkApiKey, apiRateLimiter, apiController.aiHydromind);
router.get('/ai/luminai', checkApiKey, apiRateLimiter, apiController.aiLuminai);
router.get('/ai/deepseek', checkApiKey, apiRateLimiter, apiController.aiDeepseek);
router.get('/ai/gemini-image', checkApiKey, apiRateLimiter, apiController.aiGeminiImage);
router.get('/ai/gemini', checkApiKey, apiRateLimiter, apiController.aiGeminiText); // Untuk teks
router.get('/ai/gpt4o', checkApiKey, apiRateLimiter, apiController.aiGpt4o);
router.get('/ai/gpt4', checkApiKey, apiRateLimiter, apiController.aiGpt41); // Menggunakan gpt4-1
router.get('/ai/llama', checkApiKey, apiRateLimiter, apiController.aiMetaLlama); // Endpoint untuk Llama
router.get('/ai/txt2img', checkApiKey, apiRateLimiter, apiController.aiTextToImageOrg);
router.get('/ai/txt2video', checkApiKey, apiRateLimiter, apiController.scrapeTextToVideo); // Dari contoh sebelumnya
router.get('/ai/whisper', checkApiKey, apiRateLimiter, apiController.aiWhisperTranscribe);

// Downloader Endpoints
router.get('/download/youtube', checkApiKey, apiRateLimiter, apiController.downloaderYouTube); // Menggunakan Savetube
router.get('/download/ytmp4', checkApiKey, apiRateLimiter, apiController.downloaderYouTubeMp4Mobi); // YTMP3.mobi untuk MP4
router.get('/download/ytmp3', checkApiKey, apiRateLimiter, (req, res) => { req.query.format = 'mp3'; apiController.downloaderYouTube(req,res); }); // Savetube untuk MP3
router.get('/download/instagram', checkApiKey, apiRateLimiter, apiController.downloaderInstagram); // SSSInstagram
router.get('/download/tiktok', checkApiKey, apiRateLimiter, apiController.downloaderTikTok);
router.get('/download/twitter', checkApiKey, apiRateLimiter, apiController.downloaderTwitter);
router.get('/download/mediafire', checkApiKey, apiRateLimiter, apiController.downloaderMediaFire);
router.get('/download/spotify', checkApiKey, apiRateLimiter, apiController.downloaderSpotify);
router.get('/download/douyin', checkApiKey, apiRateLimiter, apiController.downloaderDouyin); // Bisa URL download atau query search
router.get('/download/bstation', checkApiKey, apiRateLimiter, apiController.downloaderBstation); // Bisa URL download atau query search

// Search Endpoints
router.get('/search/google', checkApiKey, apiRateLimiter, apiController.searchGoogle);
router.get('/search/pinterest', checkApiKey, apiRateLimiter, apiController.searchPinterest);
router.get('/search/lyrics', checkApiKey, apiRateLimiter, apiController.searchGeniusLyrics);

// Stalk Endpoints
router.get('/stalk/instagram', checkApiKey, apiRateLimiter, apiController.stalkInstagram);
router.get('/stalk/genshin', checkApiKey, apiRateLimiter, apiController.stalkGenshin);

// Image Tools Endpoints
router.get('/tools/toanime', checkApiKey, apiRateLimiter, apiController.toolsImageToAnime);
router.get('/tools/tozombie', checkApiKey, apiRateLimiter, apiController.toolsImageToZombie);
router.get('/tools/image-enhance', checkApiKey, apiRateLimiter, apiController.toolsImageEnhancement); // tool=removebg, enhance, dll.

// Other Endpoints
router.get('/other/growagarden', checkApiKey, apiRateLimiter, apiController.scrapeGrowAGarden); // Dari contoh sebelumnya

module.exports = router;