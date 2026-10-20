
console.log("PAPERTRAIL FRONTEND SCRIPT LOADED");

const API_URL = "http://localhost:5000/api";
const SERVER_URL = "http://localhost:5000";

/* =========================================
   DOWNLOAD PAPER TO DEVICE
========================================= */

async function downloadPaper(fileUrl, paperTitle, button) {
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = "Downloading...";

        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error(
                `Download failed. Server returned ${response.status}.`
            );
        }

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The downloaded file is empty.");
        }

        // Create a temporary downloadable file
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const safeTitle = (paperTitle || "research-paper")
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
            .trim();

        link.href = objectUrl;
        link.download = `${safeTitle || "research-paper"}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        // Release the temporary URL after the download starts
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        button.textContent = "Download Started";

        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("PaperTrail download error:", error);

        alert(
            "Unable to download this paper.\n\n" +
            error.message +
            "\n\nCheck the PDF URL and backend server."
        );

        button.textContent = originalText;
        button.disabled = false;
    }
}

/* =========================================
   LOAD PAPERS
========================================= */

async function loadPapers() {
    const container = document.getElementById("papers");

    // Run only on Browse Papers page
    if (!container) return;

    container.innerHTML = "<p>Loading research papers...</p>";

    try {
        const response = await fetch(`${API_URL}/papers`);

        if (!response.ok) {
            throw new Error("Could not load papers.");
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.papers)) {
            throw new Error("Invalid response from backend.");
        }

        container.innerHTML = "";

        if (result.papers.length === 0) {
            container.innerHTML = "<p>No research papers found.</p>";
            return;
        }

        result.papers.forEach((paper) => {
            const card = document.createElement("div");
            card.className = "paper";

            const title = paper.title || "Untitled paper";
            const authors = paper.authors || "Authors not listed";
            const category = paper.category_name || "Uncategorized";
            const year = String(paper.publication_year || "");
            const abstract = paper.abstract || "No abstract available.";
            const paperUrl = paper.paper_url || "";

            card.dataset.category = category;
            card.dataset.year = year;
            card.dataset.search =
                `${title} ${authors} ${category} ${abstract}`.toLowerCase();

            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = category;

            const heading = document.createElement("h2");
            heading.textContent = title;

            const authorPara = document.createElement("p");
            const authorLabel = document.createElement("b");
            authorLabel.textContent = "Authors: ";
            authorPara.append(
                authorLabel,
                document.createTextNode(authors)
            );

            const yearPara = document.createElement("p");
            const yearLabel = document.createElement("b");
            yearLabel.textContent = "Year: ";
            yearPara.append(
                yearLabel,
                document.createTextNode(year || "Not listed")
            );

            const abstractPara = document.createElement("p");
            abstractPara.textContent = abstract;

            const actions = document.createElement("div");
            actions.className = "paper-actions";

            if (paperUrl) {
                // Support full URLs and relative upload paths
                const fileUrl = /^https?:\/\//i.test(paperUrl)
                    ? paperUrl
                    : `${SERVER_URL}/${paperUrl.replace(/^\/+/, "")}`;

                // View Paper link
                const viewLink = document.createElement("a");
                viewLink.href = fileUrl;
                viewLink.target = "_blank";
                viewLink.rel = "noopener noreferrer";
                viewLink.className = "view-btn";
                viewLink.textContent = "View Paper";

                // Download Paper button
                const downloadButton = document.createElement("button");
                downloadButton.type = "button";
                downloadButton.className = "download-btn";
                downloadButton.textContent = "Download PDF";

                downloadButton.addEventListener("click", () => {
                    downloadPaper(fileUrl, title, downloadButton);
                });

                actions.append(viewLink, downloadButton);
            } else {
                const unavailable = document.createElement("p");
                unavailable.textContent = "Paper link not available.";
                actions.appendChild(unavailable);
            }

            card.append(
                tag,
                heading,
                authorPara,
                yearPara,
                abstractPara,
                actions
            );

            container.appendChild(card);
        });

        filterPapers();

    } catch (error) {
        console.error("PaperTrail error:", error);

        container.innerHTML =
            "<p>Unable to load papers. Check whether the backend is running.</p>";
    }
}

/* =========================================
   SEARCH + CATEGORY + YEAR FILTERS
========================================= */

function filterPapers() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const yearFilter = document.getElementById("yearFilter");

    const searchText = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "all";

    const selectedYear = yearFilter
        ? yearFilter.value
        : "all";

    document.querySelectorAll("#papers .paper").forEach((paper) => {
        const searchData = (paper.dataset.search || "").toLowerCase();
        const category = paper.dataset.category || "";
        const year = paper.dataset.year || "";

        const matchesSearch = searchData.includes(searchText);

        const matchesCategory =
            !selectedCategory ||
            selectedCategory.toLowerCase() === "all" ||
            category === selectedCategory;

        const matchesYear =
            !selectedYear ||
            selectedYear.toLowerCase() === "all" ||
            year === selectedYear;

        paper.style.display =
            matchesSearch && matchesCategory && matchesYear
                ? ""
                : "none";
    });
}

/* =========================================
   UPLOAD PAPER TO BACKEND
========================================= */

async function uploadPaper(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const title = document.getElementById("title").value.trim();
    const authors = document.getElementById("authors").value.trim();
    const category = document.getElementById("category").value;
    const year = document.getElementById("year").value;
    const abstract = document.getElementById("abstract").value.trim();
    const fileInput = document.getElementById("paperFile");
    const submitButton = form.querySelector('[type="submit"]');

    if (!title || !authors || !category || !year || !abstract) {
        alert("Please fill in all required fields.");
        return;
    }

    if (!fileInput || !fileInput.files.length) {
        alert("Please select a PDF file.");
        return;
    }

    const file = fileInput.files[0];

    if (
        !file.name.toLowerCase().endsWith(".pdf") ||
        (file.type && file.type !== "application/pdf")
    ) {
        alert("Please select a valid PDF file.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("authors", authors);
    formData.append("category", category);
    formData.append("year", year);
    formData.append("abstract", abstract);
    formData.append("paperFile", file);

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Uploading...";
        }

        const response = await fetch(`${API_URL}/papers`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Could not upload the paper."
            );
        }

        alert("Paper uploaded successfully!");
        form.reset();

    } catch (error) {
        console.error("PaperTrail upload error:", error);

        alert(
            "Upload failed: " +
            error.message +
            "\nCheck the backend terminal for more details."
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Paper";
        }
    }
}

/* =========================================
   INITIALIZE PAGE
========================================= */

window.addEventListener("DOMContentLoaded", async function () {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const yearFilter = document.getElementById("yearFilter");

    if (searchInput) {
        searchInput.addEventListener("input", filterPapers);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", filterPapers);
    }

    if (yearFilter) {
        yearFilter.addEventListener("change", filterPapers);
    }

    // Read the selected category from the URL
    const params = new URLSearchParams(window.location.search);
    const categoryFromURL = params.get("category");

    if (categoryFromURL && categoryFilter) {
        const matchingOption = Array.from(categoryFilter.options).find(
            option =>
                option.value.toLowerCase() === categoryFromURL.toLowerCase()
        );

        if (matchingOption) {
            categoryFilter.value = matchingOption.value;
        }
    }

    await loadPapers();
});
