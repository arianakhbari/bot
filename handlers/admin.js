// handlers/admin.js
const { Markup } = require('telegraf');
const db = require('../models');
const logger = require('../utils/logger');
const { ADMIN_IDS } = require('../config/config');

async function adminPanel(ctx) {
    const keyboard = [
        ["👥 مدیریت کاربران"],
        ["📈 تنظیم نرخ‌ها"],
        ["🔄 مدیریت خرید و فروش"],
        ["📋 تنظیم اطلاعات بانکی ادمین"],
        ["↩️ بازگشت به منوی اصلی"]
    ];

    await ctx.reply("⚙️ **پنل مدیریت:**", Markup.keyboard(keyboard).resize());
}

async function approveUser(ctx) {
    const data = ctx.callbackQuery.data;
    const userId = parseInt(data.split('_').pop());

    const user = await db.User.findByPk(userId);
    if (user) {
        user.isVerified = true;
        await user.save();

        await ctx.telegram.sendMessage(user.telegramId, "✅ حساب شما تأیید شد! اکنون می‌توانید از امکانات ربات استفاده کنید.");
        await ctx.editMessageText("✅ کاربر تأیید شد.");
    } else {
        await ctx.editMessageText("⚠️ کاربر یافت نشد.");
    }
}

async function rejectUser(ctx) {
    const data = ctx.callbackQuery.data;
    const userId = parseInt(data.split('_').pop());

    const user = await db.User.findByPk(userId);
    if (user) {
        await user.destroy();
        await ctx.telegram.sendMessage(user.telegramId, "❌ حساب شما توسط ادمین رد شد.");
        await ctx.editMessageText("❌ کاربر رد شد.");
    } else {
        await ctx.editMessageText("⚠️ کاربر یافت نشد.");
    }
}

module.exports = {
    adminPanel,
    approveUser,
    rejectUser,
};
