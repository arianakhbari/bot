// handlers/transaction.js
const { Markup } = require('telegraf');
const db = require('../models');
const logger = require('../utils/logger');
const { ADMIN_IDS, BOT_TOKEN } = require('../config/config');

// تعریف وضعیت‌ها
const SELECT_TRANSACTION_TYPE = 'SELECT_TRANSACTION_TYPE';
const TRANSACTION_AMOUNT_TYPE = 'TRANSACTION_AMOUNT_TYPE';
const AMOUNT = 'AMOUNT';
const CONFIRM_TRANSACTION = 'CONFIRM_TRANSACTION';
const SEND_PAYMENT_PROOF = 'SEND_PAYMENT_PROOF';

// هندلر انتخاب نوع تراکنش
async function selectTransactionType(ctx) {
    const settings = await db.Settings.findOne();
    if (!settings) {
        await ctx.reply("⚠️ نرخ‌ها تنظیم نشده‌اند. لطفاً بعداً تلاش کنید.");
        return;
    }

    if (!settings.buyEnabled && !settings.sellEnabled) {
        await ctx.reply("⚠️ خرید و فروش در حال حاضر غیر فعال است.");
        return;
    }

    let textMessage = `💱 **نرخ‌های فعلی لیر:**

🛒 **خرید لیر:** ${settings.buyRate} تومان به ازای هر لیر [${settings.buyEnabled ? '✅ فعال' : '❌ غیرفعال'}]
💸 **فروش لیر:** ${settings.sellRate} تومان به ازای هر لیر [${settings.sellEnabled ? '✅ فعال' : '❌ غیرفعال'}]

🔽 لطفاً نوع تراکنش خود را انتخاب کنید:`;

    const keyboard = [];
    if (settings.buyEnabled) {
        keyboard.push([Markup.button.text("🛒 خرید لیر")]);
    }
    if (settings.sellEnabled) {
        keyboard.push([Markup.button.text("💸 فروش لیر")]);
    }
    keyboard.push([Markup.button.text("↩️ بازگشت به منوی اصلی")]);

    await ctx.replyWithMarkdown(textMessage, Markup.keyboard(keyboard).resize().oneTime());
    ctx.session.state = SELECT_TRANSACTION_TYPE;
}

// هندلر دریافت نوع تراکنش توسط کاربر
async function handleTransactionType(ctx) {
    const text = ctx.message.text.trim();

    if (text === "🛒 خرید لیر") {
        ctx.session.transactionType = 'buy';
    } else if (text === "💸 فروش لیر") {
        ctx.session.transactionType = 'sell';
    } else if (text === "↩️ بازگشت به منوی اصلی") {
        await require('./registration').mainMenu(ctx);
        return;
    } else {
        await ctx.reply("⚠️ لطفاً یکی از گزینه‌های موجود را انتخاب کنید.");
        return;
    }

    // مرحله بعدی: انتخاب نوع وارد کردن مبلغ (تومان یا لیر)
    await ctx.reply("🔢 لطفاً انتخاب کنید که مقدار را به تومان یا لیر وارد کنید:", Markup.inlineKeyboard([
        [Markup.button.callback("💰 وارد کردن به تومان", 'amount_toman')],
        [Markup.button.callback("💱 وارد کردن به لیر", 'amount_lira')]
    ]));

    ctx.session.state = TRANSACTION_AMOUNT_TYPE;
}

// هندلر انتخاب نوع وارد کردن مبلغ
async function transactionAmountTypeHandler(ctx) {
    const query = ctx.callbackQuery;
    await query.answer();
    const data = query.data;

    if (data === 'amount_toman') {
        ctx.session.amountType = 'toman';
        await query.editMessageText("🔢 لطفاً مقدار تومان را وارد کنید:");
    } else if (data === 'amount_lira') {
        ctx.session.amountType = 'lira';
        await query.editMessageText("🔢 لطفاً مقدار لیر را وارد کنید:");
    } else {
        await query.editMessageText("⚠️ گزینه نامعتبری انتخاب شده است.");
        return;
    }

    ctx.session.state = AMOUNT;
}

// هندلر دریافت مبلغ
async function handleAmount(ctx) {
    const amountText = ctx.message.text.trim();
    const amountType = ctx.session.amountType;

    let amount;
    try {
        amount = parseFloat(amountText);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("مقدار باید یک عدد مثبت باشد.");
        }

        // محدودیت‌های مبلغ
        if (amount > 100000) { // حداکثر 100,000 تومان یا لیر
            await ctx.reply("⚠️ مقدار وارد شده بیش از حد مجاز است. لطفاً مقدار کمتری وارد کنید:");
            return;
        }
        if (amount < 10) { // حداقل 10 تومان یا لیر
            await ctx.reply("⚠️ مقدار وارد شده کمتر از حد مجاز است. لطفاً مقدار بیشتری وارد کنید:");
            return;
        }

        ctx.session.amount = amount;

        // محاسبه مبلغ کل و ارائه خلاصه تراکنش
        const settings = await db.Settings.findOne();
        const transactionType = ctx.session.transactionType;

        let rate, liraAmount, totalPrice, summary;

        if (transactionType === 'buy') {
            rate = settings.buyRate;
            if (amountType === 'toman') {
                liraAmount = amount / rate;
                totalPrice = amount;
            } else {
                liraAmount = amount;
                totalPrice = amount * rate;
            }

            summary = `💰 **خرید لیر**
🔢 مقدار: ${liraAmount.toFixed(2)} لیر
💵 نرخ خرید: ${rate} تومان به ازای هر لیر
💸 مبلغ کل: ${totalPrice.toFixed(2)} تومان

آیا از انجام این تراکنش مطمئن هستید؟`;
        } else { // 'sell'
            rate = settings.sellRate;
            if (amountType === 'toman') {
                liraAmount = amount / rate;
                totalPrice = amount;
            } else {
                liraAmount = amount;
                totalPrice = amount * rate;
            }

            summary = `💸 **فروش لیر**
🔢 مقدار: ${liraAmount.toFixed(2)} لیر
💵 نرخ فروش: ${rate} تومان به ازای هر لیر
💰 مبلغ کل: ${totalPrice.toFixed(2)} تومان

آیا از انجام این تراکنش مطمئن هستید؟`;
        }

        ctx.session.totalPrice = totalPrice;

        await ctx.replyWithMarkdown(summary, Markup.inlineKeyboard([
            [Markup.button.callback("✅ تایید", 'confirm_transaction')],
            [Markup.button.callback("❌ لغو", 'cancel_transaction')]
        ]));

        ctx.session.state = CONFIRM_TRANSACTION;

    } catch (error) {
        await ctx.reply(`⚠️ خطا: ${error.message}. لطفاً یک مقدار معتبر وارد کنید.`);
    }
}

// هندلر تایید تراکنش
async function confirmTransactionHandler(ctx) {
    const query = ctx.callbackQuery;
    await query.answer();
    const data = query.data;

    if (data === 'confirm_transaction') {
        const transactionType = ctx.session.transactionType;
        const amount = ctx.session.amount;
        const amountType = ctx.session.amountType;
        const totalPrice = ctx.session.totalPrice;

        const userId = ctx.from.id;
        const user = await db.User.findOne({ where: { telegramId: userId } });
        if (!user) {
            await query.editMessageText("❌ شما هنوز ثبت‌نام نکرده‌اید.");
            return;
        }

        // ایجاد تراکنش در دیتابیس
        const transaction = await db.Transaction.create({
            userId: user.id,
            transactionType,
            amount,
            totalPrice,
            status: 'awaiting_payment',
        });

        // ارسال دستورالعمل پرداخت به کاربر
        const settings = await db.Settings.findOne();

        let paymentInstruction;
        if (transactionType === 'buy') {
            // ارسال اطلاعات بانکی ادمین ترکیه
            const adminBankInfo = settings.adminTurkeyBankAccount || "🔸 شماره ایبان ترکیه: TRXXXXXXXXXXXXXX\n🔸 نام صاحب حساب: ادمین";
            paymentInstruction = `📥 **دستورالعمل پرداخت:**

لطفاً مبلغ **${totalPrice.toFixed(2)} تومان** را به شماره ایبان زیر واریز کنید:

${adminBankInfo}

📸 پس از واریز، لطفاً فیش پرداخت خود را ارسال کنید.`;
        } else {
            // 'sell' - ارسال اطلاعات بانکی ادمین ایران
            const adminBankInfo = settings.adminIranBankAccount || "🔸 شماره شبا ایران: IRXXXXXXXXXXXXXX\n🔸 شماره کارت: XXXXXXXXXXXXXXXX\n🔸 نام صاحب حساب: ادمین";
            paymentInstruction = `📥 **دستورالعمل پرداخت:**

لطفاً مبلغ **${totalPrice.toFixed(2)} تومان** را به شماره شبا زیر واریز کنید:

${adminBankInfo}

📸 پس از واریز، لطفاً فیش پرداخت خود را ارسال کنید.`;
        }

        await ctx.reply(paymentInstruction);

        // اطلاع‌رسانی به ادمین‌ها
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, `🔔 **تراکنش جدید:**
👤 کاربر: ${user.name} ${user.familyName} (ID: ${user.id})
💱 نوع تراکنش: ${transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${amount} لیر
💰 مبلغ کل: ${totalPrice.toFixed(2)} تومان
🔄 وضعیت: ${transaction.status}`);

            await ctx.telegram.sendMessage(adminId, `📸 فیش پرداخت کاربر:`, Markup.inlineKeyboard([
                [Markup.button.callback("✅ تایید پرداخت", `approve_payment_${transaction.id}`)],
                [Markup.button.callback("❌ رد پرداخت", `reject_payment_${transaction.id}`)]
            ]));
        }

        await query.editMessageText("✅ تراکنش شما ثبت شد و در انتظار پرداخت است.");

    } else if (data === 'cancel_transaction') {
        await query.editMessageText("❌ تراکنش لغو شد.");
        // پاک کردن اطلاعات تراکنش از سشن
        ctx.session = null;
    }
}

// هندلر دریافت فیش پرداخت
async function receivePaymentProof(ctx) {
    if (!ctx.message.photo) {
        await ctx.reply("⚠️ لطفاً یک تصویر فیش پرداخت ارسال کنید.");
        return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const fileSize = photo.file_size;

    if (fileSize > 5 * 1024 * 1024) { // حداکثر 5 مگابایت
        await ctx.reply("⚠️ اندازه فایل بیش از حد مجاز است (حداکثر 5 مگابایت). لطفاً فیش کوچکتری ارسال کنید.");
        return;
    }

    try {
        const file = await ctx.telegram.getFile(fileId);
        const filePath = `payment_proofs/${ctx.from.id}_${Date.now()}.jpg`;
        const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

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

        // به‌روزرسانی تراکنش در دیتابیس
        const userId = ctx.from.id;
        const user = await db.User.findOne({ where: { telegramId: userId } });
        if (!user) {
            await ctx.reply("❌ تراکنش یافت نشد.");
            return;
        }

        const transaction = await db.Transaction.findOne({
            where: {
                userId: user.id,
                status: 'awaiting_payment'
            }
        });

        if (!transaction) {
            await ctx.reply("❌ تراکنش یافت نشد یا در وضعیت مناسبی قرار ندارد.");
            return;
        }

        transaction.paymentProof = filePath;
        transaction.status = 'payment_received';
        await transaction.save();

        await ctx.reply("✅ فیش پرداخت شما دریافت شد و در انتظار بررسی ادمین است.");

        // اطلاع‌رسانی به ادمین‌ها
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, `🔔 **فیش پرداخت برای تراکنش ${transaction.id} ارسال شده است:**
👤 کاربر: ${user.name} ${user.familyName} (ID: ${user.id})
💱 نوع تراکنش: ${transaction.transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان
🔄 وضعیت: ${transaction.status}`);

            await ctx.telegram.sendPhoto(adminId, { source: filePath }, {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("✅ تایید تراکنش", `complete_transaction_${transaction.id}`)],
                    [Markup.button.callback("❌ لغو تراکنش", `cancel_transaction_${transaction.id}`)]
                ])
            });
        }

    } catch (error) {
        logger.error(`❌ خطا در دریافت فیش پرداخت: ${error}`);
        await ctx.reply("⚠️ خطا در دریافت فیش پرداخت. لطفاً دوباره تلاش کنید.");
    }
}

// هندلر تایید پرداخت توسط ادمین
async function adminConfirmPayment(ctx) {
    const query = ctx.callbackQuery;
    await query.answer();
    const data = query.data;

    if (data.startsWith('approve_payment_')) {
        const transactionId = parseInt(data.split('_').pop());
        const transaction = await db.Transaction.findByPk(transactionId, { include: db.User });

        if (transaction && transaction.status === 'payment_received') {
            transaction.status = 'confirmed';
            await transaction.save();

            // ارسال دستورالعمل واریز به کاربر
            const settings = await db.Settings.findOne();
            const user = transaction.User;

            let adminBankInfo;
            if (transaction.transactionType === 'buy') {
                adminBankInfo = settings.adminTurkeyBankAccount || "🔸 شماره ایبان ترکیه: TRXXXXXXXXXXXXXX\n🔸 نام صاحب حساب: ادمین";
            } else {
                adminBankInfo = settings.adminIranBankAccount || "🔸 شماره شبا ایران: IRXXXXXXXXXXXXXX\n🔸 شماره کارت: XXXXXXXXXXXXXXXX\n🔸 نام صاحب حساب: ادمین";
            }

            let paymentInstruction;
            if (transaction.transactionType === 'buy') {
                paymentInstruction = `✅ **پرداخت شما تأیید شد!**

💱 نوع تراکنش: خرید لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان

📥 **اطلاعات بانکی ادمین:**
${adminBankInfo}

🔄 لطفاً مبلغ را به حساب بانکی ادمین واریز کنید و سپس فیش واریز را ارسال کنید.`;
            } else {
                paymentInstruction = `✅ **پرداخت شما تأیید شد!**

💱 نوع تراکنش: فروش لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان

📥 **اطلاعات بانکی ادمین:**
${adminBankInfo}

🔄 لطفاً مبلغ را به حساب بانکی ادمین واریز کنید و سپس فیش واریز را ارسال کنید.`;
            }

            await ctx.telegram.sendMessage(user.telegramId, paymentInstruction);

            // اطلاع‌رسانی به ادمین‌ها
            await ctx.telegram.sendMessage(user.telegramId, "🔄 لطفاً فیش واریز خود را ارسال کنید.");

            await query.editMessageText("✅ پرداخت تأیید شد و دستورالعمل واریز به کاربر ارسال شد.");
        } else {
            await query.editMessageText("⚠️ تراکنش معتبر نیست یا قبلاً تایید شده است.");
        }

    } else if (data.startsWith('reject_payment_')) {
        const transactionId = parseInt(data.split('_').pop());
        const transaction = await db.Transaction.findByPk(transactionId, { include: db.User });

        if (transaction && transaction.status === 'payment_received') {
            transaction.status = 'canceled';
            await transaction.save();

            // اطلاع‌رسانی به کاربر
            await ctx.telegram.sendMessage(transaction.User.telegramId, `❌ **پرداخت شما توسط ادمین رد شد.**

💱 نوع تراکنش: ${transaction.transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان

🔄 وضعیت تراکنش: ${transaction.status}.`);

            await query.editMessageText("❌ پرداخت رد شد.");
        } else {
            await query.editMessageText("⚠️ تراکنش معتبر نیست یا قبلاً تایید شده است.");
        }
    } else {
        await query.editMessageText("⚠️ گزینه نامعتبری انتخاب شده است.");
    }
}

// هندلر دریافت فیش واریز از کاربر پس از تایید پرداخت
async function receiveAdminPaymentProof(ctx) {
    if (!ctx.message.photo) {
        await ctx.reply("⚠️ لطفاً یک تصویر فیش واریز ارسال کنید.");
        return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const fileSize = photo.file_size;

    if (fileSize > 5 * 1024 * 1024) { // حداکثر 5 مگابایت
        await ctx.reply("⚠️ اندازه فایل بیش از حد مجاز است (حداکثر 5 مگابایت). لطفاً فیش کوچکتری ارسال کنید.");
        return;
    }

    try {
        const file = await ctx.telegram.getFile(fileId);
        const filePath = `admin_payment_proofs/${ctx.from.id}_${Date.now()}.jpg`;
        const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

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

        // به‌روزرسانی تراکنش در دیتابیس
        const transactionId = ctx.session.currentTransactionId;
        const transaction = await db.Transaction.findByPk(transactionId, { include: db.User });

        if (!transaction || transaction.status !== 'confirmed') {
            await ctx.reply("❌ تراکنش یافت نشد یا در وضعیت مناسبی قرار ندارد.");
            return;
        }

        transaction.adminPaymentProof = filePath;
        transaction.status = 'transaction_completed';
        await transaction.save();

        // اطلاع‌رسانی به ادمین‌ها
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId, `🔔 **فیش واریز برای تراکنش ${transaction.id} ارسال شده است:**
👤 کاربر: ${transaction.User.name} ${transaction.User.familyName} (ID: ${transaction.User.id})
💱 نوع تراکنش: ${transaction.transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان
🔄 وضعیت: ${transaction.status}`);

            await ctx.telegram.sendPhoto(adminId, { source: filePath }, {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("✅ تایید تراکنش", `complete_transaction_${transaction.id}`)],
                    [Markup.button.callback("❌ لغو تراکنش", `cancel_transaction_${transaction.id}`)]
                ])
            });
        }

        await ctx.reply("✅ فیش واریز شما دریافت شد و در انتظار تأیید ادمین است.");

        // پاک کردن سشن
        ctx.session = null;

    } catch (error) {
        logger.error(`❌ خطا در دریافت فیش واریز: ${error}`);
        await ctx.reply("⚠️ خطا در دریافت فیش واریز. لطفاً دوباره تلاش کنید.");
    }
}

// هندلر تایید نهایی تراکنش توسط ادمین
async function adminFinalConfirmTransaction(ctx) {
    const query = ctx.callbackQuery;
    await query.answer();
    const data = query.data;

    if (data.startsWith('complete_transaction_')) {
        const transactionId = parseInt(data.split('_').pop());
        const transaction = await db.Transaction.findByPk(transactionId, { include: db.User });

        if (transaction && transaction.status === 'transaction_completed') {
            transaction.status = 'done';
            await transaction.save();

            // ارسال پیام به کاربر درباره تکمیل تراکنش
            await ctx.telegram.sendMessage(transaction.User.telegramId, `✅ **تراکنش شما به طور کامل انجام شد!**

💱 نوع تراکنش: ${transaction.transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان
🔄 وضعیت تراکنش: ${transaction.status}.`);

            await query.editMessageText("✅ تراکنش تکمیل شد.");
        } else {
            await query.editMessageText("⚠️ تراکنش معتبر نیست یا قبلاً تکمیل شده است.");
        }

    } else if (data.startsWith('cancel_transaction_')) {
        const transactionId = parseInt(data.split('_').pop());
        const transaction = await db.Transaction.findByPk(transactionId, { include: db.User });

        if (transaction && transaction.status === 'transaction_completed') {
            transaction.status = 'canceled';
            await transaction.save();

            // اطلاع‌رسانی به کاربر
            await ctx.telegram.sendMessage(transaction.User.telegramId, `❌ **تراکنش شما لغو شد.**

💱 نوع تراکنش: ${transaction.transactionType === 'buy' ? 'خرید' : 'فروش'} لیر
🔢 مقدار: ${transaction.amount} لیر
💰 مبلغ کل: ${transaction.totalPrice.toFixed(2)} تومان
🔄 وضعیت تراکنش: ${transaction.status}.`);

            await query.editMessageText("❌ تراکنش لغو شد.");
        } else {
            await query.editMessageText("⚠️ تراکنش معتبر نیست یا قبلاً لغو شده است.");
        }
    } else {
        await query.editMessageText("⚠️ گزینه نامعتبری انتخاب شده است.");
    }
}

module.exports = {
    handleMainMenu,
    selectTransactionType,
    handleTransactionType,
    transactionAmountTypeHandler,
    handleAmount,
    confirmTransactionHandler,
    receivePaymentProof,
    adminConfirmPayment,
    receiveAdminPaymentProof,
    adminFinalConfirmTransaction,
    SELECT_TRANSACTION_TYPE,
    TRANSACTION_AMOUNT_TYPE,
    AMOUNT,
    CONFIRM_TRANSACTION,
    SEND_PAYMENT_PROOF,
};
