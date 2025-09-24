const bcrypt = require('bcryptjs');

const users = [
    {
        id: 1,
        username: 'user',
        password: bcrypt.hashSync('user', 8),
        role: 'user'
    },
    {
        id: 2,
        username: 'user2',
        password: bcrypt.hashSync('user2', 8),
        role: 'user'
    },
    {
        id: 3,
        username: 'admin',
        password: bcrypt.hashSync('admin', 8),
        role: 'admin'
    }
];

module.exports = users;
