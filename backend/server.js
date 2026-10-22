const fs = require("fs");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");

const app = express();

const PORT = 5000;

// ==========================================
// MYSQL CONNECTION
// ==========================================


const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 19710),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "research_repository",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
    ca: fs.readFileSync("./ca.pem"),
    rejectUnauthorized: true
}
});
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to Aiven MySQL successfully!");
        connection.release();
    }
});

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// UPLOAD FOLDER
// ==========================================


const uploadFolder = process.env.VERCEL
    ? path.join("/tmp", "papertrail-uploads")
    : path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

app.use("/uploads", express.static(uploadFolder));

// ==========================================
// MULTER PDF UPLOAD
// ==========================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000000) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const upload = multer({

    storage: storage,

    fileFilter: function (req, file, cb) {

        if (path.extname(file.originalname).toLowerCase() === ".pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed."));
        }
    }

});

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "PaperTrail Backend is running!"
    });

});

// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/test", async (req, res) => {

    try {

        await db.query("SELECT 1");

        res.json({
            success: true,
            message: "MySQL connected successfully!"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "MySQL connection failed.",
            error: error.message
        });

    }

});

// ==========================================
// GET ALL PAPERS
// ==========================================

app.get("/api/papers", async (req, res) => {

    try {

        const search = req.query.search || "";
        const category = req.query.category || "";
        const year = req.query.year || "";

        let sql = `
            SELECT
                paper_id,
                title,
                abstract,
                publication_year,
                category_name,
                doi,
                paper_url,
                authors
            FROM paper_details
            WHERE 1 = 1
        `;

        const values = [];

        // SEARCH
        if (search.trim() !== "") {

            sql += `
                AND (
                    title LIKE ?
                    OR abstract LIKE ?
                    OR authors LIKE ?
                    OR category_name LIKE ?
                )
            `;

            const value = `%${search}%`;

            values.push(
                value,
                value,
                value,
                value
            );
        }

        // CATEGORY
        if (category.trim() !== "" && category !== "All") {

            sql += `
                AND category_name = ?
            `;

            values.push(category);
        }

        // YEAR
        if (year.trim() !== "" && year !== "All") {

            sql += `
                AND publication_year = ?
            `;

            values.push(year);
        }

        sql += `
            ORDER BY publication_year DESC, paper_id ASC
        `;

        const [papers] = await db.query(sql, values);

        res.json({
            success: true,
            count: papers.length,
            papers: papers
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load papers.",
            error: error.message
        });

    }

});

// ==========================================
// GET SINGLE PAPER
// ==========================================

app.get("/api/papers/:id", async (req, res) => {

    try {

        const id = req.params.id;

        const [papers] = await db.query(
            `
            SELECT
                paper_id,
                title,
                abstract,
                publication_year,
                category_name,
                doi,
                paper_url,
                authors
            FROM paper_details
            WHERE paper_id = ?
            `,
            [id]
        );

        if (papers.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Paper not found."
            });

        }

        // Get keywords
        const [keywords] = await db.query(
            `
            SELECT k.keyword_name
            FROM keywords k
            INNER JOIN paper_keywords pk
                ON k.keyword_id = pk.keyword_id
            WHERE pk.paper_id = ?
            ORDER BY k.keyword_name
            `,
            [id]
        );

        const paper = papers[0];

        paper.keywords = keywords.map(
            keyword => keyword.keyword_name
        );

        res.json({
            success: true,
            paper: paper
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load paper.",
            error: error.message
        });

    }

});

// ==========================================
// GET CATEGORIES
// ==========================================

app.get("/api/categories", async (req, res) => {

    try {

        const [categories] = await db.query(
            `
            SELECT
                category_id,
                category_name
            FROM categories
            ORDER BY category_name
            `
        );

        res.json({
            success: true,
            categories: categories
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Could not load categories.",
            error: error.message
        });

    }

});

// ==========================================
// ADD NEW PAPER
// ==========================================

app.post(
    "/api/papers",
    upload.single("paperFile"),
    async (req, res) => {

        const connection = await db.getConnection();

        try {

            const {
                title,
                authors,
                category,
                year,
                abstract,
                keywords,
                source
            } = req.body;

            // ----------------------------------
            // VALIDATION
            // ----------------------------------

            if (!title || !authors || !category || !year) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Title, authors, category and year are required."
                });

            }

            await connection.beginTransaction();

            // ----------------------------------
            // FIND CATEGORY
            // ----------------------------------

            const [categoryRows] = await connection.query(
                `
                SELECT category_id
                FROM categories
                WHERE category_name = ?
                `,
                [category]
            );

            if (categoryRows.length === 0) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Selected category does not exist."
                });

            }

            const categoryId = categoryRows[0].category_id;

            // ----------------------------------
            // FILE URL
            // ----------------------------------

            let paperURL = source || null;

            if (req.file && !paperURL) {

                paperURL =
                    `http://localhost:${PORT}/uploads/${req.file.filename}`;
            }

            // ----------------------------------
            // INSERT PAPER
            // ----------------------------------

            const [paperResult] = await connection.query(
                `
                INSERT INTO papers
                (
                    title,
                    abstract,
                    publication_year,
                    category_id,
                    doi,
                    paper_url
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    title,
                    abstract || null,
                    year,
                    categoryId,
                    null,
                    paperURL
                ]
            );

            const paperId = paperResult.insertId;

            // ----------------------------------
            // ADD AUTHORS
            // ----------------------------------

            /*
                Authors can be ANY number.

                Example:

                Ashish Vaswani, Noam Shazeer,
                Niki Parmar, Jakob Uszkoreit
            */

            const authorList = authors
                .split(",")
                .map(author => author.trim())
                .filter(author => author !== "");

            for (let i = 0; i < authorList.length; i++) {

                const authorName = authorList[i];

                // Check existing author
                const [existing] = await connection.query(
                    `
                    SELECT author_id
                    FROM authors
                    WHERE author_name = ?
                    `,
                    [authorName]
                );

                let authorId;

                if (existing.length > 0) {

                    authorId = existing[0].author_id;

                } else {

                    const [newAuthor] = await connection.query(
                        `
                        INSERT INTO authors
                        (author_name)
                        VALUES (?)
                        `,
                        [authorName]
                    );

                    authorId = newAuthor.insertId;
                }

                // Connect author with paper
                await connection.query(
                    `
                    INSERT INTO paper_authors
                    (
                        paper_id,
                        author_id,
                        author_order
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        paperId,
                        authorId,
                        i + 1
                    ]
                );
            }

            // ----------------------------------
            // ADD KEYWORDS
            // ----------------------------------

            if (keywords && keywords.trim() !== "") {

                const keywordList = keywords
                    .split(",")
                    .map(keyword => keyword.trim())
                    .filter(keyword => keyword !== "");

                for (const keywordName of keywordList) {

                    const [existingKeyword] =
                        await connection.query(
                            `
                            SELECT keyword_id
                            FROM keywords
                            WHERE keyword_name = ?
                            `,
                            [keywordName]
                        );

                    let keywordId;

                    if (existingKeyword.length > 0) {

                        keywordId =
                            existingKeyword[0].keyword_id;

                    } else {

                        const [newKeyword] =
                            await connection.query(
                                `
                                INSERT INTO keywords
                                (keyword_name)
                                VALUES (?)
                                `,
                                [keywordName]
                            );

                        keywordId = newKeyword.insertId;
                    }

                    await connection.query(
                        `
                        INSERT INTO paper_keywords
                        (
                            paper_id,
                            keyword_id
                        )
                        VALUES (?, ?)
                        `,
                        [
                            paperId,
                            keywordId
                        ]
                    );
                }
            }

            await connection.commit();

            res.status(201).json({

                success: true,

                message:
                    "Research paper uploaded successfully.",

                paper_id: paperId

            });

        } catch (error) {

            await connection.rollback();

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Could not upload the research paper.",

                error: error.message

            });

        } finally {

            connection.release();

        }

    }
);

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

    console.error(error);

    res.status(500).json({

        success: false,

        message:
            error.message || "Something went wrong."

    });

});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("     PAPERTRAIL BACKEND");
    console.log("================================");
    console.log("");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Papers: http://localhost:${PORT}/api/papers`);
    console.log(`Test:   http://localhost:${PORT}/api/test`);
    console.log("");
    console.log("================================");

});
