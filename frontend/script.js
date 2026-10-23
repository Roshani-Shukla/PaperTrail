/* ====================================================================
   PAPERTRAIL — FRONTEND CONTROLLER
   Research Paper Repository
   ==================================================================== */

// Determine API base URL dynamically:
// - Same origin when served by Express or reverse proxy (e.g. deployed on Vercel/Render)
// - Fallback to https://vercel.app when opened via Live Server or file://
function getApiBaseUrl() {
    if (
        window.location.protocol === "file:" ||
        window.location.port === "5500" ||
        window.location.port === "3000" ||
        window.location.port === "8080"
    ) {
        // आम्ही इथे तुमच्या लाईव्ह बॅकएंडची लिंक https:// सह जोडली आहे:
        return "https://vercel.app";
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
        .replace(/'/g, "'");
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
