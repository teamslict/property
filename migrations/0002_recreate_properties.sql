-- Drop existing properties table
DROP TABLE IF EXISTS properties;

-- Create new properties table with updated schema
CREATE TABLE properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    property_type TEXT NOT NULL,
    address TEXT NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area REAL NOT NULL,
    price REAL NOT NULL,
    listing_type TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    amenities TEXT,
    photos TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);