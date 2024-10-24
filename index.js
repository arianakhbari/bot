// index.js
require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const config = require('./config/config');
const db = require('./models');
const logger = require('./utils/logger');
const registration = require('./handlers/registration');
const transaction = require('./handlers/transaction');
const admin = require('./handlers/admin');
const handleError = require('./handlers/errorHandler');

// همگام‌سازی دیتابیس
db.sequelize.sync().then(() => {
    logger.info('Database synchronized');
}).catch(err => {
    logger.error('Error synchronizing database:', err);
});

// ایجاد بوت
const bot = new Telegraf(config.BOT_TOKEN);

// استفاده از سشن برای ذخیره وضعیت کاربران
bot.use(session());

// فرمان /start
bot.start((ctx) => {
    ctx.reply('خوش آمدید! از دستور /menu برای مشاهده گزینه‌ها استفاده کنید.');
});

bot.command('menu', registrationHandler.mainMenu);

// هندلر برای دریافت پیام‌های متنی
bot.on('text', async (ctx) => {
    const state = ctx.session.state;
    if (state === registration.NAME) {
        await registration.getName(ctx);
    } else if (state === registration.FAMILY_NAME) {
        await registration.getFamilyName(ctx);
    } else if (state === registration.COUNTRY) {
        await registration.getCountry(ctx);
    } else if (state === registration.PHONE) {
        await registration.getPhone(ctx);
    } else if (state === registration.ID_CARD) {
        await registration.getIdCard(ctx);
    } else if (state === transaction.SELECT_TRANSACTION_TYPE) {
        await transaction.handleTransactionType(ctx);
    } else if (state === transaction.AMOUNT) {
        await transaction.handleAmount(ctx);
    }
    // سایر حالت‌ها مانند مدیریت حساب بانکی، تاریخچه تراکنش‌ها و پشتیبانی
});

// هندلر برای دریافت تماس‌ها
bot.on('contact', async (ctx) => {
    const state = ctx.session.state;
    if (state === registration.PHONE) {
        await registration.getPhone(ctx);
    }
});

// هندلر برای دریافت عکس‌ها
bot.on('photo', async (ctx) => {
    const state = ctx.session.state;
    if (state === registration.ID_CARD) {
        await registration.getIdCard(ctx);
    } else if (state === transaction.SEND_PAYMENT_PROOF) {
        await transaction.receivePaymentProof(ctx);
    } else if (state === transaction.SEND_PAYMENT_PROOF) {
        await transaction.receivePaymentProof(ctx);
    }
    // سایر حالت‌ها مانند ارسال فیش پرداخت
});

// هندلر کلیک‌های دکمه‌های Inline
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('approve_user_')) {
        await admin.approveUser(ctx);
    } else if (data.startsWith('reject_user_')) {
        await admin.rejectUser(ctx);
    } else if (data.startsWith('amount_')) {
        await transaction.transactionAmountTypeHandler(ctx);
    } else if (data === 'confirm_transaction' || data === 'cancel_transaction') {
        await transaction.confirmTransactionHandler(ctx);
    } else if (data.startsWith('approve_payment_') || data.startsWith('reject_payment_')) {
        await transaction.adminConfirmPayment(ctx);
    } else if (data.startsWith('complete_transaction_') || data.startsWith('cancel_transaction_')) {
        await transaction.adminFinalConfirmTransaction(ctx);
    } else if (data.startsWith('send_admin_payment_proof_')) {
        // این هندلر باید توسط ادمین فراخوانی شود
        await transaction.receiveAdminPaymentProof(ctx);
    }
    // سایر callback ها
});

// هندلر خطاها
bot.catch(async (err, ctx) => {
    await handleError(ctx, err);
});

// شروع ربات
bot.launch().then(() => {
    logger.info('Bot started');
}).catch(err => {
    logger.error('Error starting bot:', err);
});

// لغو ربات به درستی در هنگام پایان برنامه
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
