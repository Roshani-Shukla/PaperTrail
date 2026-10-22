CREATE DATABASE IF NOT EXISTS research_repository;
USE research_repository;

CREATE TABLE authors (
    author_id INT AUTO_INCREMENT PRIMARY KEY,
    author_name VARCHAR(150) NOT NULL,
    affiliation VARCHAR(255)
);

CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE papers (
    paper_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    abstract TEXT,
    publication_year YEAR,
    category_id INT,
    doi VARCHAR(255),
    paper_url VARCHAR(500),
    download_url VARCHAR(500),

    FOREIGN KEY (category_id)
        REFERENCES categories(category_id)
        ON DELETE SET NULL
);

CREATE TABLE paper_authors (
    paper_id INT,
    author_id INT,
    author_order INT,

    PRIMARY KEY (paper_id, author_id),

    FOREIGN KEY (paper_id)
        REFERENCES papers(paper_id)
        ON DELETE CASCADE,

    FOREIGN KEY (author_id)
        REFERENCES authors(author_id)
        ON DELETE CASCADE
);

CREATE TABLE keywords (
    keyword_id INT AUTO_INCREMENT PRIMARY KEY,
    keyword_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE paper_keywords (
    paper_id INT,
    keyword_id INT,

    PRIMARY KEY (paper_id, keyword_id),

    FOREIGN KEY (paper_id)
        REFERENCES papers(paper_id)
        ON DELETE CASCADE,

    FOREIGN KEY (keyword_id)
        REFERENCES keywords(keyword_id)
        ON DELETE CASCADE
);


INSERT INTO categories (category_name) VALUES
('Artificial Intelligence'),
('Machine Learning'),
('Deep Learning'),
('Computer Science'),
('Natural Language Processing'),
('Computer Vision'),
('Data Science'),
('Networking');


INSERT INTO authors (author_name, affiliation) VALUES
('Martín Abadi', 'Google'),
('Ashish Agarwal', 'Google'),
('Paul Barham', 'Google'),
('Eugene Brevdo', 'Google'),
('Zhifeng Chen', 'Google'),
('Craig Citro', 'Google'),
('Greg S. Corrado', 'Google'),
('Andy Davis', 'Google'),
('Jeffrey Dean', 'Google'),
('Matthieu Devin', 'Google'),
('Sanjay Ghemawat', 'Google'),
('Ian Goodfellow', 'Google'),
('Yoshua Bengio', 'Université de Montréal'),
('Aaron Courville', 'Université de Montréal'),
('Geoffrey Hinton', 'University of Toronto'),
('Ashish Vaswani', 'Google'),
('Noam Shazeer', 'Google'),
('Niki Parmar', 'Google'),
('Jakob Uszkoreit', 'Google'),
('Llion Jones', 'Google'),
('Aidan N. Gomez', 'University of Toronto'),
('Łukasz Kaiser', 'Google Brain'),
('Illia Polosukhin', 'NEAR AI'),
('Jacob Devlin', 'Google'),
('Ming-Wei Chang', 'Google'),
('Kenton Lee', 'Google'),
('Kristina Toutanova', 'Google'),
('Tom B. Brown', 'OpenAI'),
('Benjamin Mann', 'OpenAI'),
('Nick Ryder', 'OpenAI'),
('Melanie Subbiah', 'OpenAI'),
('Jared Kaplan', 'OpenAI'),
('Prafulla Dhariwal', 'OpenAI'),
('Arvind Neelakantan', 'OpenAI'),
('Pranav Shyam', 'OpenAI'),
('Girish Sastry', 'OpenAI'),
('Amanda Askell', 'OpenAI'),
('Sandhini Agarwal', 'OpenAI'),
('Ariel Herbert-Voss', 'OpenAI'),
('Gretchen Krueger', 'OpenAI'),
('Tom Henighan', 'OpenAI'),
('Rewon Child', 'OpenAI'),
('Aditya Ramesh', 'OpenAI'),
('Dario Amodei', 'OpenAI'),
('Kaiming He', 'Microsoft Research'),
('Xiangyu Zhang', 'Microsoft Research'),
('Shaoqing Ren', 'Microsoft Research'),
('Jian Sun', 'Microsoft Research'),
('Alex Krizhevsky', 'University of Toronto'),
('Ilya Sutskever', 'University of Toronto'),
('Diederik P. Kingma', 'University of Amsterdam'),
('Jimmy Ba', 'University of Toronto'),
('Tomas Mikolov', 'Google'),
('Kai Chen', 'Google'),
('Greg Corrado', 'Google'),
('Jeffrey Dean', 'Google'),
('Naveed Akhtar', 'University of Western Australia'),
('Ajmal Mian', 'University of Western Australia');


INSERT INTO papers
(title, abstract, publication_year, category_id, doi, paper_url, download_url)
VALUES

(
'TensorFlow: Large-Scale Machine Learning on Heterogeneous Distributed Systems',
'TensorFlow is an interface for expressing machine learning algorithms and an implementation for executing them across heterogeneous distributed systems.',
2016,
2,
NULL,
'https://arxiv.org/abs/1603.04467',
'https://arxiv.org/pdf/1603.04467'
),

(
'Deep Learning',
'This paper provides an overview of deep learning and discusses how deep neural networks have transformed machine learning applications.',
2015,
3,
'10.1038/nature14539',
'https://doi.org/10.1038/nature14539',
'https://doi.org/10.1038/nature14539'
),

(
'Attention Is All You Need',
'This work introduces the Transformer architecture, based entirely on attention mechanisms, without using recurrence or convolution.',
2017,
3,
'10.48550/arXiv.1706.03762',
'https://arxiv.org/abs/1706.03762',
'https://arxiv.org/pdf/1706.03762'
),

(
'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
'BERT introduces a bidirectional transformer-based pre-training approach for learning language representations.',
2018,
5,
'10.48550/arXiv.1810.04805',
'https://arxiv.org/abs/1810.04805',
'https://arxiv.org/pdf/1810.04805'
),

(
'Language Models are Few-Shot Learners',
'The paper investigates large language models and demonstrates strong performance on few-shot learning tasks.',
2020,
5,
'10.48550/arXiv.2005.14165',
'https://arxiv.org/abs/2005.14165',
'https://arxiv.org/pdf/2005.14165'
),

(
'Generative Adversarial Nets',
'Generative adversarial networks introduce a framework involving two neural networks competing in a minimax game to generate data.',
2014,
1,
'10.48550/arXiv.1406.2661',
'https://arxiv.org/abs/1406.2661',
'https://arxiv.org/pdf/1406.2661'
),

(
'ImageNet Classification with Deep Convolutional Neural Networks',
'This work demonstrates the effectiveness of deep convolutional neural networks for large-scale image classification.',
2012,
6,
'10.1145/3065386',
'https://doi.org/10.1145/3065386',
'https://papers.nips.cc/paper_files/paper/2012/file/c399862d3b9d6b76c8436e924a68c45b-Paper.pdf'
),

(
'Deep Residual Learning for Image Recognition',
'Residual learning provides a framework that enables training of substantially deeper neural networks for image recognition.',
2015,
6,
'10.1109/CVPR.2016.90',
'https://arxiv.org/abs/1512.03385',
'https://arxiv.org/pdf/1512.03385'
),

(
'Unsupervised Machine Learning for Networking: Techniques, Applications and Research Challenges',
'This survey examines unsupervised machine learning techniques and their applications in computer networking.',
2017,
8,
NULL,
'https://arxiv.org/abs/1709.06599',
'https://arxiv.org/pdf/1709.06599'
),

(
'Threat of Adversarial Attacks on Deep Learning in Computer Vision: A Survey',
'This survey examines adversarial attacks against deep learning systems used in computer vision and discusses possible defenses.',
2018,
6,
NULL,
'https://arxiv.org/abs/1801.00553',
'https://arxiv.org/pdf/1801.00553'
);


INSERT INTO paper_authors VALUES
(1,1,1),
(1,2,2),
(1,3,3),
(1,4,4),
(1,5,5),
(1,6,6),
(1,7,7),
(1,8,8),
(1,9,9),
(1,10,10),
(1,11,11),
(1,12,12);

INSERT INTO paper_authors VALUES
(2,13,1),
(2,14,2),
(2,15,3);

INSERT INTO paper_authors VALUES
(3,16,1),
(3,17,2),
(3,18,3),
(3,19,4),
(3,20,5),
(3,21,6),
(3,22,7),
(3,23,8);

INSERT INTO paper_authors VALUES
(4,24,1),
(4,25,2),
(4,26,3),
(4,27,4);

INSERT INTO paper_authors VALUES
(5,28,1),
(5,29,2),
(5,30,3),
(5,31,4),
(5,32,5),
(5,33,6),
(5,34,7),
(5,35,8),
(5,36,9),
(5,37,10),
(5,38,11),
(5,39,12),
(5,40,13),
(5,41,14),
(5,42,15),
(5,43,16),
(5,44,17);

INSERT INTO paper_authors VALUES
(6,12,1),
(6,13,2),
(6,14,3);

INSERT INTO paper_authors VALUES
(7,47,1),
(7,48,2),
(7,15,3);

INSERT INTO paper_authors VALUES
(8,45,1),
(8,46,2),
(8,47,3),
(8,48,4);

INSERT INTO paper_authors VALUES
(9,54,1),
(9,55,2);

INSERT INTO paper_authors VALUES
(10,56,1),
(10,57,2);


INSERT INTO keywords (keyword_name) VALUES
('Machine Learning'),
('Artificial Intelligence'),
('Deep Learning'),
('Neural Networks'),
('Transformer'),
('NLP'),
('Computer Vision'),
('Image Classification'),
('Adversarial Attacks'),
('Networking'),
('Distributed Systems'),
('Generative Models'),
('Large Language Models'),
('Few-Shot Learning');


INSERT INTO paper_keywords VALUES
(1,1),
(1,11),

(2,3),
(2,4),

(3,3),
(3,5),
(3,6),

(4,5),
(4,6),

(5,1),
(5,2),
(5,13),
(5,14),

(6,2),
(6,12),

(7,3),
(7,7),
(7,8),

(8,3),
(8,7),
(8,8),

(9,1),
(9,10),

(10,3),
(10,7),
(10,9);


CREATE VIEW paper_details AS
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