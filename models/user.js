// models/user.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        telegramId: {
            type: DataTypes.INTEGER,
            unique: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        familyName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING,
            allowNull: false, // 'Iran' یا 'Turkey'
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'users',
    });

    return User;
};
