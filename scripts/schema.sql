-- CIS 5500 — Data-Driven Shopping Assistant
-- Database Schema
-- Run this ONCE on AWS RDS PostgreSQL instance before ingesting data.

-- Drop existing tables (in reverse dependency order) if re-creating
DROP TABLE IF EXISTS Reviews CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS Products CASCADE;
DROP TABLE IF EXISTS Brands CASCADE;
DROP TABLE IF EXISTS Categories CASCADE;

-- Categories (from amazon_categories.csv — uses original IDs, not SERIAL)
CREATE TABLE Categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL UNIQUE
);

-- Brands (extracted from product titles during cleaning)
CREATE TABLE Brands (
    brand_id INTEGER PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL UNIQUE
);

-- Products
-- Note: `bought_in_last_month` is intentionally omitted. The US asaniczka
-- 1.4M dataset does not include that field. Recent-popularity queries
-- compute `recent_review_count` on the fly from Reviews.review_timestamp.
CREATE TABLE Products (
    asin VARCHAR(20) PRIMARY KEY,
    title VARCHAR(1024),
    img_url TEXT,
    product_url TEXT,
    price DECIMAL(10, 2),
    list_price DECIMAL(10, 2),
    stars DECIMAL(2, 1),
    review_count INTEGER DEFAULT 0,
    is_best_seller BOOLEAN DEFAULT FALSE,
    category_id INTEGER REFERENCES Categories(category_id),
    brand_id INTEGER REFERENCES Brands(brand_id)
);

-- Users
CREATE TABLE Users (
    user_id VARCHAR(128) PRIMARY KEY
);

-- Reviews
CREATE TABLE Reviews (
    review_id INTEGER PRIMARY KEY,
    asin VARCHAR(20) NOT NULL REFERENCES Products(asin),
    user_id VARCHAR(128) NOT NULL REFERENCES Users(user_id),
    rating DECIMAL(2, 1) NOT NULL,
    review_title VARCHAR(1024),
    review_text TEXT,
    helpful_vote INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE,
    review_timestamp TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX idx_products_category ON Products(category_id);
CREATE INDEX idx_products_brand ON Products(brand_id);
CREATE INDEX idx_products_stars ON Products(stars);
CREATE INDEX idx_products_price ON Products(price);
CREATE INDEX idx_reviews_asin ON Reviews(asin);
CREATE INDEX idx_reviews_user ON Reviews(user_id);
CREATE INDEX idx_reviews_rating ON Reviews(rating);
-- NOTE: Do NOT add an index on Reviews(asin, review_timestamp) yet.
-- You want that query slow pre-optimization so Milestone 5 can show a
-- meaningful before/after speedup for the recent-popularity query.
