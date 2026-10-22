const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load .env from backend folder first, fallback to root folder
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Resolve SSL CA certificate
function getSslConfig() {
    if (process.env.DB_SSL === "false" || process.env.DB_SSL === "0") {
        return undefined;
    }

    // 1. Direct CA certificate content in environment variable
    if (process.env.DB_SSL_CA) {
        return {
            ca: process.env.DB_SSL_CA,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
        };
    }

    // 2. Custom CA certificate path
    const candidatePaths = [
        process.env.DB_SSL_CA_PATH,
        path.join(__dirname, "ca.pem"),
        path.join(__dirname, "..", "ca.pem"),
        path.join(process.cwd(), "ca.pem"),
        path.join(process.cwd(), "backend", "ca.pem")
    ].filter(Boolean);

    for (const certPath of candidatePaths) {
        if (fs.existsSync(certPath)) {
            try {
                return {
                    ca: fs.readFileSync(certPath),
                    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
                };
            } catch (err) {
                console.warn(`[DB] Warning: could not read CA cert at ${certPath}:`, err.message);
            }
        }
    }

    // If host is Aiven cloud or remote, SSL is required
    const host = process.env.DB_HOST || "localhost";
    const isRemote = host !== "localhost" && host !== "127.0.0.1";
    if (isRemote) {
        return {
            rejectUnauthorized: false
        };
    }

    return undefined;
}

const poolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "research_repository",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
};

const sslConfig = getSslConfig();
if (sslConfig) {
    poolConfig.ssl = sslConfig;
}

const pool = mysql.createPool(poolConfig);

/**
 * Test database connectivity safely without leaking credentials
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`[DB] Connected to MySQL (${poolConfig.database} @ ${poolConfig.host}:${poolConfig.port}) successfully.`);
        connection.release();
        return { ok: true };
    } catch (error) {
        console.error(`[DB] Database connection error: ${error.message}`);
        return { ok: false, error: error.message };
    }
}

module.exports = pool;
module.exports.testConnection = testConnection;
