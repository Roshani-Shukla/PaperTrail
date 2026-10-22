/* ====================================================================
   PAPERTRAIL — FRONTEND CONTROLLER
   Research Paper Repository
   ==================================================================== */

// Determine API base URL dynamically:
// - Same origin when served by Express or reverse proxy (e.g. deployed on Vercel/Render)
// - Fallback to http://localhost:5000 when opened via Live Server (port 5500) or file://
function getApiBaseUrl() {
    if (
        window.location.protocol === "file:" ||
        window.location.port === "5500" ||
        window.location.port === "3000" ||
        window.location.port === "8080"
    ) {
        return "http://localhost:5000";
    }
    return window.location.origin;
}

const SERVER_URL = getApiBaseUrl();
const API_URL = `${SERVER_URL}/api`;

console.log("[PaperTrail] Backend endpoint configured at:", API_URL);

let allPapersData = [];

/* ====================================================================
   HELPER: SANITIZE TEXT TO AVOID HTML INJECTION
   ==================================================================== */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ====================================================================
   DYNAMIC CATEGORY LOADER
   Populates dropdowns on Browse and Upload pages from backend DB
   ==================================================================== */
async function loadCategories() {
    const browseCategorySelect = document.getElementById("categoryFilter");
    const uploadCategorySelect = document.getElementById("category");

    if (!browseCategorySelect && !uploadCategorySelect) return;

    try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) return;

        const result = await response.json();
        if (!result.success || !Array.isArray(result.categories)) return;

        // 1. Populate Browse Filter
        if (browseCategorySelect) {
            const currentValue = browseCategorySelect.value;
            browseCategorySelect.innerHTML = '<option value="all">All Categories</option>';
            result.categories.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat.category_name;
                opt.textContent = cat.category_name;
                browseCategorySelect.appendChild(opt);
            });
            if (currentValue) browseCategorySelect.value = currentValue;
        }

        // 2. Populate Upload Select
        if (uploadCategorySelect) {
            const currentValue = uploadCategorySelect.value;
            uploadCategorySelect.innerHTML = '<option value="">Select Category</option>';
            result.categories.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat.category_name;
                opt.textContent = cat.category_name;
                uploadCategorySelect.appendChild(opt);
            });
            if (currentValue) uploadCategorySelect.value = currentValue;
        }

    } catch (err) {
        console.warn("[PaperTrail] Could not refresh categories from server, using default options.", err.message);
    }
}

/* ====================================================================
   POPULATE YEARS FILTER DYNAMICALLY
   ==================================================================== */
function populateYearFilter(papers) {
    const yearFilter = document.getElementById("yearFilter");
    if (!yearFilter) return;

    const currentYear = yearFilter.value;
    const yearsSet = new Set();

    papers.forEach(p => {
        if (p.publication_year) {
            yearsSet.add(Number(p.publication_year));
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    yearFilter.innerHTML = '<option value="all">All Years</option>';
    sortedYears.forEach(yr => {
        const opt = document.createElement("option");
        opt.value = String(yr);
        opt.textContent = String(yr);
        yearFilter.appendChild(opt);
    });

    if (currentYear && (currentYear === "all" || yearsSet.has(Number(currentYear)))) {
        yearFilter.value = currentYear;
    }
}

/* ====================================================================
   DOWNLOAD PAPER VIA BACKEND ENDPOINT
   ==================================================================== */
async function downloadPaper(paperId, paperTitle, button) {
    if (!paperId) return;

    const originalText = button ? button.textContent : "Download PDF";

    try {
        if (button) {
            button.disabled = true;
            button.textContent = "Downloading...";
        }

        // Use backend dedicated download endpoint
        const downloadEndpoint = `${API_URL}/papers/${paperId}/download`;

        // Create temporary link to trigger browser download
        const link = document.createElement("a");
        link.href = downloadEndpoint;
        link.setAttribute("download", "");
        document.body.appendChild(link);
        link.click();
        link.remove();

        if (button) {
            button.textContent = "Download Started";
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2500);
        }

    } catch (error) {
        console.error("[PaperTrail] Download error:", error);
        alert(`Download failed: ${error.message}\nPlease check backend connectivity.`);
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
}

/* ====================================================================
   LOAD PAPERS FROM BACKEND
   ==================================================================== */
async function loadPapers() {
    const container = document.getElementById("papers");
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading research papers from repository...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/papers`);

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.papers)) {
            throw new Error("Invalid response format received from backend.");
        }

        allPapersData = result.papers;
        populateYearFilter(allPapersData);

        if (allPapersData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Research Papers Found</h3>
                    <p>The repository database currently contains no papers.</p>
                    <a href="upload.html" class="btn">Upload the First Paper</a>
                </div>
            `;
            return;
        }

        renderPapers(allPapersData);

        // Apply any active filters (e.g. from URL parameters)
        filterPapers();

    } catch (error) {
        console.error("[PaperTrail] Error loading papers:", error);
        container.innerHTML = `
            <div class="error-state">
                <h3>Unable to Connect to PaperTrail Repository</h3>
                <p>Could not fetch papers from <code>${escapeHtml(API_URL)}/papers</code>.</p>
                <p class="error-detail">${escapeHtml(error.message)}</p>
                <button class="btn btn-retry" onclick="loadPapers()">Retry Connection</button>
            </div>
        `;
    }
}

/* ====================================================================
   RENDER PAPERS GRID
   ==================================================================== */
function renderPapers(papers) {
    const container = document.getElementById("papers");
    if (!container) return;

    container.innerHTML = "";

    papers.forEach(paper => {
        const card = document.createElement("div");
        card.className = "paper";
        card.id = `paper-${paper.paper_id}`;

        const title = paper.title || "Untitled paper";
        const authors = paper.authors || "Authors not listed";
        const category = paper.category_name || "Uncategorized";
        const year = String(paper.publication_year || "");
        const abstract = paper.abstract || "No abstract available.";
        const paperUrl = paper.paper_url || "";
        const keywords = paper.keywords || "";

        // Dataset for instant client-side search & filtering
        card.dataset.category = category;
        card.dataset.year = year;
        card.dataset.search = `${title} ${authors} ${category} ${abstract} ${keywords}`.toLowerCase();

        // 1. Category Tag
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = category;

        // 2. Title
        const heading = document.createElement("h2");
        heading.textContent = title;

        // 3. Authors
        const authorPara = document.createElement("p");
        authorPara.className = "paper-meta";
        const authorLabel = document.createElement("b");
        authorLabel.textContent = "Authors: ";
        authorPara.append(authorLabel, document.createTextNode(authors));

        // 4. Year
        const yearPara = document.createElement("p");
        yearPara.className = "paper-meta";
        const yearLabel = document.createElement("b");
        yearLabel.textContent = "Year: ";
        yearPara.append(yearLabel, document.createTextNode(year || "Not listed"));

        // 6. Keywords chips
        let keywordsBox = null;
        if (keywords && keywords.trim() !== "") {
            keywordsBox = document.createElement("div");
            keywordsBox.className = "keywords-list";
            const kwList = keywords.split(",").map(k => k.trim()).filter(Boolean);
            kwList.forEach(kw => {
                const pill = document.createElement("span");
                pill.className = "keyword-pill";
                pill.textContent = kw;
                pill.title = `Filter by keyword: ${kw}`;
                pill.addEventListener("click", () => {
                    const searchInput = document.getElementById("searchInput");
                    if (searchInput) {
                        searchInput.value = kw;
                        filterPapers();
                        searchInput.scrollIntoView({ behavior: "smooth" });
                    }
                });
                keywordsBox.appendChild(pill);
            });
        }

        // 7. Abstract
        const abstractPara = document.createElement("p");
        abstractPara.className = "paper-abstract";
        abstractPara.textContent = abstract;

        // 8. Action buttons
        const actions = document.createElement("div");
        actions.className = "paper-actions";

        // View Paper link
        if (paperUrl) {
            // Normalize URL: local uploads get prepended with SERVER_URL
            let fileViewUrl = paperUrl;
            if (!/^https?:\/\//i.test(paperUrl)) {
                fileViewUrl = `${SERVER_URL}/${paperUrl.replace(/^\/+/, "")}`;
            } else if (paperUrl.includes("localhost:5000")) {
                // If stored with old localhost URL, adapt to current SERVER_URL
                fileViewUrl = paperUrl.replace(/https?:\/\/localhost:5000/, SERVER_URL);
            }

            const viewLink = document.createElement("a");
            viewLink.href = fileViewUrl;
            viewLink.target = "_blank";
            viewLink.rel = "noopener noreferrer";
            viewLink.className = "view-btn";
            viewLink.textContent = "View Paper";
            actions.appendChild(viewLink);
        }

        // Download Paper button (always routes through backend download endpoint)
        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "download-btn";
        downloadButton.textContent = "Download PDF";
        downloadButton.addEventListener("click", () => {
            downloadPaper(paper.paper_id, title, downloadButton);
        });
        actions.appendChild(downloadButton);

        // Assemble card
        card.append(tag, heading, authorPara, yearPara);
        if (keywordsBox) card.appendChild(keywordsBox);
        card.append(abstractPara, actions);

        container.appendChild(card);
    });
}

/* ====================================================================
   SEARCH + CATEGORY + YEAR FILTERS
   ==================================================================== */
function filterPapers() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const yearFilter = document.getElementById("yearFilter");
    const container = document.getElementById("papers");

    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedCategory = categoryFilter ? categoryFilter.value : "all";
    const selectedYear = yearFilter ? yearFilter.value : "all";

    const paperCards = document.querySelectorAll("#papers .paper");
    let visibleCount = 0;

    paperCards.forEach(paper => {
        const searchData = (paper.dataset.search || "").toLowerCase();
        const category = paper.dataset.category || "";
        const year = paper.dataset.year || "";

        const matchesSearch = !searchText || searchData.includes(searchText);

        const matchesCategory =
            !selectedCategory ||
            selectedCategory.toLowerCase() === "all" ||
            category.toLowerCase() === selectedCategory.toLowerCase();

        const matchesYear =
            !selectedYear ||
            selectedYear.toLowerCase() === "all" ||
            year === selectedYear;

        if (matchesSearch && matchesCategory && matchesYear) {
            paper.style.display = "";
            visibleCount++;
        } else {
            paper.style.display = "none";
        }
    });

    // Handle empty search results state
    let emptyNotice = document.getElementById("noMatchesNotice");
    if (visibleCount === 0 && paperCards.length > 0) {
        if (!emptyNotice) {
            emptyNotice = document.createElement("div");
            emptyNotice.id = "noMatchesNotice";
            emptyNotice.className = "empty-state";
            emptyNotice.innerHTML = `
                <h3>No Matching Papers</h3>
                <p>No research papers matched your current search and filter criteria.</p>
                <button type="button" class="btn btn-secondary" onclick="resetFilters()">Reset All Filters</button>
            `;
            container.appendChild(emptyNotice);
        }
    } else if (emptyNotice) {
        emptyNotice.remove();
    }
}

/* ====================================================================
   RESET ALL FILTERS
   ==================================================================== */
function resetFilters() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const yearFilter = document.getElementById("yearFilter");

    if (searchInput) searchInput.value = "";
    if (categoryFilter) categoryFilter.value = "all";
    if (yearFilter) yearFilter.value = "all";

    filterPapers();
}

/* ====================================================================
   UPLOAD RESEARCH PAPER TO BACKEND
   ==================================================================== */
async function uploadPaper(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const titleInput = document.getElementById("title");
    const authorsInput = document.getElementById("authors");
    const categoryInput = document.getElementById("category");
    const yearInput = document.getElementById("year");
    const abstractInput = document.getElementById("abstract");
    const keywordsInput = document.getElementById("keywords");
    const fileInput = document.getElementById("paperFile");
    const submitButton = form.querySelector('[type="submit"]');
    const statusBox = document.getElementById("uploadStatus");

    function showStatus(message, type) {
        if (!statusBox) {
            alert(message);
            return;
        }
        statusBox.className = `status-box status-${type}`;
        statusBox.innerHTML = message;
        statusBox.style.display = "block";
        statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const title = titleInput.value.trim();
    const authors = authorsInput.value.trim();
    const category = categoryInput.value.trim();
    const year = yearInput.value.trim();
    const abstract = abstractInput.value.trim();
    const keywords = keywordsInput ? keywordsInput.value.trim() : "";

    // Client-side validation
    if (!title || !authors || !category || !year || !abstract) {
        showStatus("Please fill in all required fields marked with an asterisk.", "error");
        return;
    }

    const numericYear = Number(year);
    if (isNaN(numericYear) || numericYear < 1900 || numericYear > 2100) {
        showStatus("Please enter a valid 4-digit publication year (e.g. 2024).", "error");
        return;
    }

    if (!fileInput || !fileInput.files.length) {
        showStatus("Please select a PDF document to upload.", "error");
        return;
    }

    const file = fileInput.files[0];

    // File validation: extension and MIME
    if (!file.name.toLowerCase().endsWith(".pdf")) {
        showStatus("Only PDF documents are accepted (.pdf). Please select a valid PDF file.", "error");
        return;
    }

    // File size limit: 15MB
    const MAX_SIZE_MB = 15;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showStatus(`The selected PDF is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.`, "error");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("authors", authors);
    formData.append("category", category);
    formData.append("year", year);
    formData.append("abstract", abstract);
    if (keywords) formData.append("keywords", keywords);
    formData.append("paperFile", file);

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Uploading Paper...";
        }

        if (statusBox) {
            statusBox.style.display = "none";
        }

        const response = await fetch(`${API_URL}/papers`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `Upload failed with status ${response.status}`);
        }

        showStatus(
            `<strong>Success!</strong> "${escapeHtml(title)}" has been uploaded to PaperTrail successfully.` +
            `<br><a href="browse.html" class="status-link">Browse papers to view your upload &rarr;</a>`,
            "success"
        );

        form.reset();

    } catch (error) {
        console.error("[PaperTrail] Upload error:", error);
        showStatus(
            `<strong>Upload Failed:</strong> ${escapeHtml(error.message)}.<br>` +
            `Ensure the backend server is running and database is reachable.`,
            "error"
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Paper";
        }
    }
}

/* ====================================================================
   INITIALIZE ON PAGE LOAD
   ==================================================================== */
window.addEventListener("DOMContentLoaded", async function () {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const yearFilter = document.getElementById("yearFilter");

    // Dynamic search with real-time input
    if (searchInput) {
        searchInput.addEventListener("input", filterPapers);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", filterPapers);
    }

    if (yearFilter) {
        yearFilter.addEventListener("change", filterPapers);
    }

    // Load dynamic categories from backend
    await loadCategories();

    // Handle incoming URL parameters (e.g. ?category=Machine+Learning or ?search=NLP)
    const params = new URLSearchParams(window.location.search);
    const categoryFromURL = params.get("category");
    const searchFromURL = params.get("search");

    if (searchFromURL && searchInput) {
        searchInput.value = searchFromURL;
    }

    if (categoryFromURL && categoryFilter) {
        const matchingOption = Array.from(categoryFilter.options).find(
            opt => opt.value.toLowerCase() === categoryFromURL.toLowerCase()
        );
        if (matchingOption) {
            categoryFilter.value = matchingOption.value;
        }
    }

    // Load papers on browse page
    await loadPapers();
});
