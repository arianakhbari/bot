// models/index.js
const { Sequelize } = require('sequelize');
const config = require('../config/config');
const logger = require('../utils/logger');

const sequelize = new Sequelize({
    dialect: config.DB.dialect,
    storage: config.DB.storage,
    logging: (msg) => logger.info(msg),
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// وارد کردن مدل‌ها
db.User = require('./user')(sequelize, Sequelize);
db.BankAccount = require('./bankAccount')(sequelize, Sequelize);
db.Transaction = require('./transaction')(sequelize, Sequelize);
db.Settings = require('./settings')(sequelize, Sequelize);

// تعریف روابط بین مدل‌ها
db.User.hasMany(db.BankAccount, { foreignKey: 'userId' });
db.BankAccount.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasMany(db.Transaction, { foreignKey: 'userId' });
db.Transaction.belongsTo(db.User, { foreignKey: 'userId' });

module.exports = db;
