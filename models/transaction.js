// models/transaction.js
module.exports = (sequelize, DataTypes) => {
    const Transaction = sequelize.define('Transaction', {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        transactionType: {
            type: DataTypes.STRING, // 'buy' یا 'sell'
            allowNull: false,
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        totalPrice: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending', // 'pending', 'awaiting_payment', 'payment_received', 'confirmed', 'canceled', 'done', 'transaction_completed'
        },
        paymentProof: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        adminPaymentProof: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'transactions',
    });

    return Transaction;
};
