const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function initializeDatabase() {
    // Open database
    const db = await open({
        filename: 'property.db',
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS properties (
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
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert test data
    await db.exec(`
        INSERT INTO properties (name, email, phone, property_type, address, bedrooms, bathrooms, area, price, listing_type, description, status)
        VALUES 
        ('John Doe', 'john@example.com', '1234567890', 'house', '123 Main St', 3, 2, 1500, 350000, 'sale', 'Beautiful house with garden', 'pending'),
        ('Jane Smith', 'jane@example.com', '0987654321', 'apartment', '456 Park Ave', 2, 1, 800, 200000, 'sale', 'Modern apartment in city center', 'approved'),
        ('Bob Wilson', 'bob@example.com', '5555555555', 'condo', '789 Beach Rd', 4, 3, 2000, 500000, 'sale', 'Luxury beachfront condo', 'rejected');

        INSERT INTO contact_messages (name, email, subject, message)
        VALUES 
        ('Alice Cooper', 'alice@example.com', 'Property Inquiry', 'I am interested in the house on Main St'),
        ('David Brown', 'david@example.com', 'Viewing Request', 'Would like to schedule a viewing');

        INSERT INTO newsletter_subscriptions (email)
        VALUES 
        ('subscriber1@example.com'),
        ('subscriber2@example.com');
    `);

    console.log('Database initialized with test data!');
    await db.close();
}

initializeDatabase().catch(console.error);