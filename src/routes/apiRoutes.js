const express = require('express');
const { checkApiKey } = require('../middlewares/authMiddleware');
const {
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
    enhanceController,
    upscaleController,
    restoreController,
    colorizeController,
    removebgController,
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
} = require('../controllers/apiController');

const router = express.Router();

router.use(checkApiKey); 
router.get('/hydromind', aiHydromindController);
router.get('/gemini-image', geminiImageController);
router.get('/luminai', aiLuminaiController);
router.get('/bibli', bibliController);
router.get('/deepseek', deepseekController);
router.get('/douyin', douyinController);
router.get('/genshinstalk', genshinStalkController); 
router.get('/gemini', geminiController);
router.get('/heroml', heroMlController);
router.get('/gpt4-1', gpt41Controller);
router.get('/googlesearch', googleSearchController);
router.get('/gpt4-o', gpt4oController);
router.get('/toanime', toAnimeController);
router.get('/igstalk', igStalkController);
router.get('/mediafire', mediafireController);
router.get('/instagram', instagramController);
router.get('/enhance', enhanceController);
router.get('/upscale', upscaleController);
router.get('/restore', restoreController);
router.get('/colorize', colorizeController);
router.get('/removebg', removebgController);
router.get('/genius', lirikController); 
router.get('/llama', metaController);
router.get('/pinterest', pinterestController);
router.get('/spotify', spotifyController);
router.get('/twitter', twitterController);
router.get('/tozombie', toZombieController);
router.get('/ytmp4', ytmp4Controller);
router.get('/text2img', text2imgController);
router.get('/ytmp3', ytmp3Controller);
router.get('/whisper', whisperController);
router.get('/tiktok', tiktokController);

module.exports = router;