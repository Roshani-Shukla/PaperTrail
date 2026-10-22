-- ====================================================================
-- PaperTrail Migration: Update paper_details View
-- Purpose: Expose download_url and keywords in paper_details view
-- Safe: Does not modify tables, delete data, or affect existing foreign keys.
-- ====================================================================

CREATE OR REPLACE VIEW paper_details AS
SELECT
    p.paper_id,
    p.title,
    p.abstract,
    p.publication_year,
    c.category_name,
    p.paper_url,
    p.download_url,
    GROUP_CONCAT(
        a.author_name
        ORDER BY pa.author_order
        SEPARATOR ', '
    ) AS authors,
    (
        SELECT GROUP_CONCAT(k.keyword_name ORDER BY k.keyword_name SEPARATOR ', ')
        FROM paper_keywords pk
        JOIN keywords k ON pk.keyword_id = k.keyword_id
        WHERE pk.paper_id = p.paper_id
    ) AS keywords
FROM papers p
LEFT JOIN categories c
    ON p.category_id = c.category_id
LEFT JOIN paper_authors pa
    ON p.paper_id = pa.paper_id
LEFT JOIN authors a
    ON pa.author_id = a.author_id
GROUP BY
    p.paper_id,
    p.title,
    p.abstract,
    p.publication_year,
    c.category_name,
    p.paper_url,
    p.download_url;
