
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Roshani@001",
    database: "research_repository",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;

