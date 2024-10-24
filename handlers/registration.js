// handlers/registration.js
const { Markup } = require('telegraf');
const db = require('../models');
const logger = require('../utils/logger');
const { ADMIN_IDS } = require('../config/config');

const NAME = 'NAME';
const FAMILY_NAME = 'FAMILY_NAME';
const COUNTRY = 'COUNTRY';
const PHONE = 'PHONE';
const ID_CARD = 'ID_CARD';

async function mainMenu(ctx) {
    const keyboard = [
        [Markup.button.text('📈 تراکنش')],
        [Markup.button.text('👤 ثبت‌نام')],
        [Markup.button.text('ℹ️ درباره ما')]
    ];

    await ctx.reply('لطفاً یک گزینه را انتخاب کنید:', Markup.keyboard(keyboard).resize().oneTime());
}

async function start(ctx) {
    const userId = ctx.from.id;
    const user = await db.User.findOne({ where: { telegramId: userId } });
    if (user) {
        if (user.isVerified) {
            await ctx.reply("✅ شما قبلاً ثبت‌نام کرده‌اید و حساب شما تأیید شده است.", Markup.removeKeyboard());
            await mainMenu(ctx);
        } else {
            await ctx.reply("⏳ حساب شما در انتظار تأیید است. لطفاً صبور باشید.", Markup.removeKeyboard());
        }
    } else {
        await ctx.reply("👋 سلام! برای استفاده از ربات، لطفاً فرآیند احراز هویت را تکمیل کنید.\nلطفاً نام خود را وارد کنید:", Markup.removeKeyboard());
        ctx.session.state = NAME;
    }
}

async function getName(ctx) {
    const name = ctx.message.text.trim();
    if (!name) {
        await ctx.reply("⚠️ نام نمی‌تواند خالی باشد. لطفاً دوباره وارد کنید:");
        return;
    }
    ctx.session.name = name;
    await ctx.reply("👤 لطفاً نام خانوادگی خود را وارد کنید:");
    ctx.session.state = FAMILY_NAME;
}

async function getFamilyName(ctx) {
    const familyName = ctx.message.text.trim();
    if (!familyName) {
        await ctx.reply("⚠️ نام خانوادگی نمی‌تواند خالی باشد. لطفاً دوباره وارد کنید:");
        return;
    }
    ctx.session.familyName = familyName;
    await ctx.reply("🌍 کشور محل سکونت خود را انتخاب کنید:", Markup.keyboard([
        ["🇮🇷 ایران", "🇹🇷 ترکیه"]
    ]).oneTime().resize());
    ctx.session.state = COUNTRY;
}

async function getCountry(ctx) {
    const countryText = ctx.message.text.trim();
    if (!["🇮🇷 ایران", "🇹🇷 ترکیه"].includes(countryText)) {
        await ctx.reply("⚠️ لطفاً یکی از گزینه‌های موجود را انتخاب کنید.", Markup.keyboard([
            ["🇮🇷 ایران", "🇹🇷 ترکیه"]
        ]).oneTime().resize());
        return;
    }
    ctx.session.country = countryText === "🇮🇷 ایران" ? 'Iran' : 'Turkey';
    await ctx.reply("📞 لطفاً شماره تلفن خود را ارسال کنید:", Markup.keyboard([
        Markup.button.contactRequest("📞 ارسال شماره تلفن")
    ]).oneTime().resize());
    ctx.session.state = PHONE;
}

async function getPhone(ctx) {
    if (!ctx.message.contact) {
        await ctx.reply("⚠️ لطفاً شماره تلفن خود را ارسال کنید:", Markup.keyboard([
            Markup.button.contactRequest("📞 ارسال شماره تلفن")
        ]).oneTime().resize());
        return;
    }

    let phoneNumber = ctx.message.contact.phone_number.replace(/\D/g, '');
    logger.info(`Received phone number: ${ctx.message.contact.phone_number}`);
    logger.info(`Sanitized phone number: ${phoneNumber}`);

    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        await ctx.reply("⚠️ شماره تلفن نامعتبر است. لطفاً یک شماره تلفن معتبر ارسال کنید:", Markup.keyboard([
            Markup.button.contactRequest("📞 ارسال شماره تلفن")
        ]).oneTime().resize());
        return;
    }

    ctx.session.phone = phoneNumber;
    await ctx.reply("📄 لطفاً تصویر کارت ملی یا پاسپورت خود را ارسال کنید:", Markup.removeKeyboard());
    ctx.session.state = ID_CARD;
}

async function getIdCard(ctx) {
    if (!ctx.message.photo) {
        await ctx.reply("⚠️ لطفاً یک تصویر ارسال کنید.");
        return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const fileSize = photo.file_size;

    if (fileSize > 5 * 1024 * 1024) { // حداکثر 5 مگابایت
        await ctx.reply("⚠️ اندازه فایل بیش از حد مجاز است (حداکثر 5 مگابایت). لطفاً عکس کوچکتری ارسال کنید.");
        return;
    }

    try {
        const file = await ctx.telegram.getFile(fileId);
        const filePath = `user_data/${ctx.from.id}_id.jpg`;
        const url = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const axios = require('axios');
        const fs = require('fs');
        const writer = fs.createWriteStream(filePath);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        ctx.session.idCard = filePath;
        await ctx.reply("📥 اطلاعات شما دریافت شد و در انتظار تأیید ادمین است.");

        // ذخیره اطلاعات کاربر در دیتابیس
        const user = await db.User.create({
            telegramId: ctx.from.id,
            name: ctx.session.name,
            familyName: ctx.session.familyName,
            country: ctx.session.country,
            phone: ctx.session.phone,
            isVerified: false,
        });

        // اطلاع رسانی به ادمین‌ها
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, `📋 کاربر جدید:
👤 نام: ${user.name} ${user.familyName}
🌍 کشور: ${user.country}
📞 شماره تلفن: ${user.phone}`);
            await ctx.telegram.sendPhoto(adminId, { source: filePath });
            await ctx.telegram.sendMessage(adminId, `🔄 لطفاً کاربر ${user.id} را تأیید یا رد کنید:`, Markup.inlineKeyboard([
                Markup.button.callback("✅ تأیید", `approve_user_${user.id}`),
                Markup.button.callback("❌ رد", `reject_user_${user.id}`)
            ]));
        }
    } catch (error) {
        logger.error(`❌ خطا در ذخیره‌سازی اطلاعات کاربر: ${error}`);
        await ctx.reply("⚠️ خطا در ذخیره‌سازی اطلاعات شما. لطفاً دوباره تلاش کنید.");
    }

    ctx.session = null;
}

async function mainMenu(ctx) {
    const keyboard = [
        ["💱 لیر"],
        ["🏦 مدیریت حساب‌های بانکی"],
        ["📜 تاریخچه تراکنش‌ها"],
        ["📞 پشتیبانی"]
    ];

    if (ADMIN_IDS.includes(ctx.from.id)) {
        keyboard.push(["⚙️ پنل مدیریت"]);
    }

    await ctx.reply("📂 به منوی اصلی خوش آمدید. لطفاً یکی از گزینه‌ها را انتخاب کنید:", Markup.keyboard(keyboard).resize());
}

module.exports = {
    mainMenu,
    start,
    getName,
    getFamilyName,
    getCountry,
    getPhone,
    getIdCard,
    mainMenu,
    NAME,
    FAMILY_NAME,
    COUNTRY,
    PHONE,
    ID_CARD,
};
