const { v4: uuidv4 } = require('uuid');

const generateApiKey = () => {
  return uuidv4();
};

module.exports = generateApiKey;