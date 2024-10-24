// models/bankAccount.js
module.exports = (sequelize, DataTypes) => {
    const BankAccount = sequelize.define('BankAccount', {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING,
            allowNull: false, // 'Iran' یا 'Turkey'
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'bank_accounts',
    });

    return BankAccount;
};
