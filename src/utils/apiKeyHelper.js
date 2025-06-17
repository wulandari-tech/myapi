const { v4: uuidv4 } = require('uuid');

const generateApiKey = () => {
    return `wanzofc-${uuidv4()}`;
};

module.exports = { generateApiKey };