// handlers/errorHandler.js
const logger = require('../utils/logger');
const { ADMIN_IDS } = require('../config/config');

async function handleError(ctx, error) {
    logger.error('Exception while handling an update:', error);
    if (ctx.update && ctx.update.message && ctx.update.message.chat) {
        await ctx.reply("⚠️ خطایی در سرور رخ داده است. لطفاً بعداً تلاش کنید.");
    }

    for (const adminId of ADMIN_IDS) {
        await ctx.telegram.sendMessage(adminId, `⚠️ یک خطا در ربات رخ داده است:\n${error.message}`);
    }
}

module.exports = handleError;
