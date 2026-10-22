const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE & CORS
// ==========================================

const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(url => url.trim())
    : ["*"];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all during dev/testing, configurable in prod
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// STATIC FILES & UPLOAD STORAGE
// ==========================================

const uploadFolder = process.env.VERCEL
    ? path.join("/tmp", "papertrail-uploads")
    : path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

// Serve uploaded papers
app.use("/uploads", express.static(uploadFolder));

// Serve frontend static files
const frontendFolder = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendFolder)) {
    app.use(express.static(frontendFolder));
}

// ==========================================
// MULTER PDF UPLOAD CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const safeExt = path.extname(file.originalname).toLowerCase() || ".pdf";
        cb(null, `${uniqueSuffix}${safeExt}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15 MB limit
    },
    fileFilter: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        if (ext === ".pdf" || mime === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF documents are allowed."));
        }
    }
});

// Helper to sanitize filenames for Content-Disposition header
function sanitizeFilename(title) {
    return (title || "research-paper")
        .replace(/[^a-zA-Z0-9_\-\. ]/g, "_")
        .trim()
        .substring(0, 100);
}

// ==========================================
// ROOT & HEALTH CHECK ROUTES
// ==========================================

app.get("/api/test", async (req, res) => {
    try {
        await db.query("SELECT 1 AS health");
        res.json({
            success: true,
            message: "MySQL database is connected and healthy.",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed.",
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
            "SELECT category_id, category_name FROM categories ORDER BY category_name ASC"
        );
        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        console.error("Categories error:", error);
        res.status(500).json({
            success: false,
            message: "Could not load categories.",
            error: error.message
        });
    }
});

// ==========================================
// GET ALL PAPERS (SEARCH & FILTER)
// ==========================================

app.get("/api/papers", async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const year = (req.query.year || "").trim();

        let sql = `
            SELECT
                paper_id,
                title,
                abstract,
                publication_year,
                category_name,
                paper_url,
                download_url,
                authors,
                keywords
            FROM paper_details
            WHERE 1 = 1
        `;

        const values = [];

        // Search in title, abstract, authors, category, and keywords
        if (search !== "") {
            sql += `
                AND (
                    title LIKE ?
                    OR abstract LIKE ?
                    OR authors LIKE ?
                    OR category_name LIKE ?
                    OR keywords LIKE ?
                )
            `;
            const term = `%${search}%`;
            values.push(term, term, term, term, term);
        }

        // Category filter
        if (category !== "" && category.toLowerCase() !== "all") {
            sql += " AND LOWER(category_name) = LOWER(?)";
            values.push(category);
        }

        // Year filter
        if (year !== "" && year.toLowerCase() !== "all") {
            sql += " AND publication_year = ?";
            values.push(year);
        }

        sql += " ORDER BY publication_year DESC, paper_id DESC";

        const [papers] = await db.query(sql, values);

        res.json({
            success: true,
            count: papers.length,
            papers: papers
        });
    } catch (error) {
        console.error("Papers fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Could not load research papers.",
            error: error.message
        });
    }
});

// ==========================================
// GET SINGLE PAPER DETAILS
// ==========================================

app.get("/api/papers/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid paper ID."
            });
        }

        const [papers] = await db.query(
            `
            SELECT
                paper_id,
                title,
                abstract,
                publication_year,
                category_name,
                paper_url,
                download_url,
                authors,
                keywords
            FROM paper_details
            WHERE paper_id = ?
            `,
            [id]
        );

        if (papers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Research paper not found."
            });
        }

        const paper = papers[0];
        paper.keywords = paper.keywords
            ? paper.keywords.split(",").map(k => k.trim()).filter(Boolean)
            : [];

        res.json({
            success: true,
            paper: paper
        });
    } catch (error) {
        console.error("Paper details error:", error);
        res.status(500).json({
            success: false,
            message: "Could not load paper details.",
            error: error.message
        });
    }
});

// ==========================================
// DOWNLOAD PAPER ENDPOINT
// ==========================================

app.get("/api/papers/:id/download", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid paper ID."
            });
        }

        const [rows] = await db.query(
            "SELECT paper_id, title, paper_url, download_url FROM papers WHERE paper_id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Paper not found."
            });
        }

        const paper = rows[0];
        const rawTarget = paper.download_url || paper.paper_url;

        if (!rawTarget) {
            return res.status(404).json({
                success: false,
                message: "No document file available for this paper."
            });
        }

        const safeTitle = sanitizeFilename(paper.title);
        const downloadFilename = `${safeTitle}.pdf`;

        // Case 1: Local file upload
        const isLocalUpload = rawTarget.includes("/uploads/") || (!rawTarget.startsWith("http://") && !rawTarget.startsWith("https://"));

        if (isLocalUpload) {
            const fileName = path.basename(rawTarget);
            const filePath = path.join(uploadFolder, fileName);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: "The requested paper file is missing on the server storage."
                });
            }

            res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);
            res.setHeader("Content-Type", "application/pdf");
            return res.sendFile(filePath);
        }

        // Case 2: Remote URL (e.g. arXiv)
        if (rawTarget.startsWith("http://") || rawTarget.startsWith("https://")) {
            try {
                const response = await fetch(rawTarget, {
                    headers: {
                        "User-Agent": "PaperTrail-Research-Repository/1.0"
                    }
                });

                if (!response.ok) {
                    console.warn(`[Download] Remote fetch returned ${response.status}, redirecting user directly.`);
                    return res.redirect(rawTarget);
                }

                res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);
                res.setHeader("Content-Type", response.headers.get("content-type") || "application/pdf");

                const { Readable } = require("stream");
                return Readable.fromWeb(response.body).pipe(res);
            } catch (fetchErr) {
                console.error("[Download] Streaming error, falling back to redirect:", fetchErr.message);
                return res.redirect(rawTarget);
            }
        }

        return res.status(400).json({
            success: false,
            message: "Unsupported paper download source."
        });

    } catch (error) {
        console.error("Download endpoint error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to download paper.",
            error: error.message
        });
    }
});

// ==========================================
// ADD NEW PAPER (UPLOAD)
// ==========================================

app.post("/api/papers", upload.single("paperFile"), async (req, res) => {
    let connection;

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

        // Validation
        if (!title || !title.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: "Paper title is required." });
        }

        if (!authors || !authors.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: "At least one author is required." });
        }

        if (!category || !category.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: "Category is required." });
        }

        const pubYear = Number(year);
        if (!pubYear || pubYear < 1900 || pubYear > 2100) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: "Valid 4-digit publication year is required." });
        }

        if (!abstract || !abstract.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: "Abstract description is required." });
        }

        if (!req.file && (!source || !source.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please upload a PDF file or provide a source URL."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Resolve or Create Category
        const trimmedCategory = category.trim();
        const [categoryRows] = await connection.query(
            "SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER(?)",
            [trimmedCategory]
        );

        let categoryId;
        if (categoryRows.length > 0) {
            categoryId = categoryRows[0].category_id;
        } else {
            const [newCategory] = await connection.query(
                "INSERT INTO categories (category_name) VALUES (?)",
                [trimmedCategory]
            );
            categoryId = newCategory.insertId;
        }

        // 2. Resolve URLs
        let paperURL = source && source.trim() ? source.trim() : null;
        let downloadURL = null;

        if (req.file) {
            const relativeUploadPath = `/uploads/${req.file.filename}`;
            paperURL = relativeUploadPath;
            downloadURL = relativeUploadPath;
        }

        // 3. Insert Paper
        const [paperResult] = await connection.query(
            `
            INSERT INTO papers (
                title,
                abstract,
                publication_year,
                category_id,
                paper_url,
                download_url
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                title.trim(),
                abstract.trim(),
                pubYear,
                categoryId,
                paperURL,
                downloadURL
            ]
        );

        const paperId = paperResult.insertId;

        // 4. Update download_url if pointing to internal download endpoint
        if (!downloadURL) {
            downloadURL = `/api/papers/${paperId}/download`;
            await connection.query(
                "UPDATE papers SET download_url = ? WHERE paper_id = ?",
                [downloadURL, paperId]
            );
        }

        // 5. Add Authors
        const authorList = authors
            .split(",")
            .map(a => a.trim())
            .filter(Boolean);

        for (let i = 0; i < authorList.length; i++) {
            const authorName = authorList[i];
            const [existing] = await connection.query(
                "SELECT author_id FROM authors WHERE LOWER(author_name) = LOWER(?)",
                [authorName]
            );

            let authorId;
            if (existing.length > 0) {
                authorId = existing[0].author_id;
            } else {
                const [newAuthor] = await connection.query(
                    "INSERT INTO authors (author_name) VALUES (?)",
                    [authorName]
                );
                authorId = newAuthor.insertId;
            }

            await connection.query(
                "INSERT INTO paper_authors (paper_id, author_id, author_order) VALUES (?, ?, ?)",
                [paperId, authorId, i + 1]
            );
        }

        // 6. Add Keywords
        if (keywords && keywords.trim() !== "") {
            const keywordList = keywords
                .split(",")
                .map(k => k.trim())
                .filter(Boolean);

            for (const keywordName of keywordList) {
                const [existingKw] = await connection.query(
                    "SELECT keyword_id FROM keywords WHERE LOWER(keyword_name) = LOWER(?)",
                    [keywordName]
                );

                let keywordId;
                if (existingKw.length > 0) {
                    keywordId = existingKw[0].keyword_id;
                } else {
                    const [newKw] = await connection.query(
                        "INSERT INTO keywords (keyword_name) VALUES (?)",
                        [keywordName]
                    );
                    keywordId = newKw.insertId;
                }

                await connection.query(
                    "INSERT INTO paper_keywords (paper_id, keyword_id) VALUES (?, ?)",
                    [paperId, keywordId]
                );
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Research paper uploaded successfully.",
            paper_id: paperId
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error("Error removing uploaded file after failed transaction:", unlinkErr.message);
            }
        }

        console.error("Paper upload error:", error);
        res.status(500).json({
            success: false,
            message: "Could not upload the research paper.",
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// ==========================================
// DELETE PAPER (OPTIONAL CRUD MANAGEMENT)
// ==========================================

app.delete("/api/papers/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, message: "Invalid paper ID." });
        }

        const [rows] = await db.query(
            "SELECT paper_id, paper_url, download_url FROM papers WHERE paper_id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Paper not found." });
        }

        const paper = rows[0];
        const target = paper.download_url || paper.paper_url;

        // If local file, clean it up
        if (target && target.includes("/uploads/")) {
            const fileName = path.basename(target);
            const filePath = path.join(uploadFolder, fileName);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.warn("Could not delete physical paper file:", err.message);
                }
            }
        }

        await db.query("DELETE FROM papers WHERE paper_id = ?", [id]);

        res.json({
            success: true,
            message: "Paper deleted successfully."
        });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({
            success: false,
            message: "Could not delete paper.",
            error: error.message
        });
    }
});

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Uploaded file is too large. Maximum size is 15 MB."
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    }

    if (err) {
        console.error("Server error:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "An unexpected error occurred."
        });
    }

    next();
});

// ==========================================
// START SERVER
// ==========================================

if (require.main === module && !process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log("");
        console.log("================================");
        console.log("     PAPERTRAIL BACKEND");
        console.log("================================");
        console.log(`Port:   ${PORT}`);
        console.log(`Server: http://localhost:${PORT}`);
        console.log(`API:    http://localhost:${PORT}/api/papers`);
        console.log(`Health: http://localhost:${PORT}/api/test`);
        console.log("================================");
        console.log("");

        // Test database connectivity on boot
        await db.testConnection();
    });
}

module.exports = app;
