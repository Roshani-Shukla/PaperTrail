/* =========================================
   PAPERTRAIL JAVASCRIPT
========================================= */


/* =========================================
   SEARCH + FILTER PAPERS
========================================= */

function filterPapers() {

    const searchInput =
        document.getElementById("searchInput");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const yearFilter =
        document.getElementById("yearFilter");

    const papers =
        document.querySelectorAll(".paper");


    if (!searchInput || !categoryFilter || !yearFilter) {
        return;
    }


    const searchText =
        searchInput.value.toLowerCase().trim();

    const selectedCategory =
        categoryFilter.value;

    const selectedYear =
        yearFilter.value;


    papers.forEach(function (paper) {

        const searchData =
            paper.getAttribute("data-search").toLowerCase();

        const category =
            paper.getAttribute("data-category");

        const year =
            paper.getAttribute("data-year");


        const matchesSearch =
            searchData.includes(searchText);

        const matchesCategory =
            selectedCategory === "all" ||
            category === selectedCategory;

        const matchesYear =
            selectedYear === "all" ||
            year === selectedYear;


        if (
            matchesSearch &&
            matchesCategory &&
            matchesYear
        ) {

            paper.style.display = "block";

        } else {

            paper.style.display = "none";

        }

    });

}


/* =========================================
   UPLOAD PAPER
========================================= */

function uploadPaper(event) {

    event.preventDefault();


    const title =
        document.getElementById("title").value;

    const file =
        document.getElementById("paperFile").files[0];


    if (!file) {

        alert("Please select a PDF file.");

        return;

    }


    if (file.type !== "application/pdf") {

        alert("Only PDF files are allowed.");

        return;

    }


    alert(
        "Paper submitted successfully!\n\n" +
        "Title: " + title
    );


    document.querySelector("form").reset();

}


/* =========================================
   CATEGORY URL FILTER
========================================= */

window.addEventListener("DOMContentLoaded", function () {

    const params =
        new URLSearchParams(window.location.search);

    const category =
        params.get("category");


    const categoryFilter =
        document.getElementById("categoryFilter");


    if (
        category &&
        categoryFilter
    ) {

        categoryFilter.value = category;

        filterPapers();

    }

});