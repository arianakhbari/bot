// models/settings.js
module.exports = (sequelize, DataTypes) => {
    const Settings = sequelize.define('Settings', {
        buyRate: {
            type: DataTypes.FLOAT,
            defaultValue: 1000.0, // نرخ خرید (تومان به لیر)
        },
        sellRate: {
            type: DataTypes.FLOAT,
            defaultValue: 950.0, // نرخ فروش (لیر به تومان)
        },
        buyEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        sellEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        adminIranBankAccount: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        adminTurkeyBankAccount: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'settings',
    });

    return Settings;
};
