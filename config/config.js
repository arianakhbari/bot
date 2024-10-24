// config/config.js

require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_IDS: process.env.ADMIN_IDS
        ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
        : [],
    DB: {
        dialect: 'sqlite',
        storage: 'bot.db',
        logging: false,
    },
};
