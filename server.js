const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "https:", "data:", "blob:"],
            "script-src": ["'self'", "'unsafe-inline'", "https:", "cdn.tailwindcss.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https:"],
        },
    },
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// Database connection
let db;
async function initializeDb() {
    db = await open({
        filename: 'property.db',
        driver: sqlite3.Database
    });
}
initializeDb();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    // TODO: Implement proper authentication
    // For now, we'll use a simple API key check
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.ADMIN_API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Admin API Routes
app.get('/api/admin/properties', authenticateAdmin, async (req, res) => {
    try {
        const status = req.query.status;
        let query = 'SELECT * FROM properties';
        if (status && status !== 'all') {
            query += ' WHERE status = ?';
        }
        query += ' ORDER BY created_at DESC';

        const properties = status && status !== 'all' 
            ? await db.all(query, status)
            : await db.all(query);

        res.json({ properties });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/admin/properties/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, phone, propertyType, address, bedrooms,
            bathrooms, area, price, listingType, description, status
        } = req.body;

        await db.run(`
            UPDATE properties 
            SET name = ?, email = ?, phone = ?, property_type = ?, 
                address = ?, bedrooms = ?, bathrooms = ?, area = ?,
                price = ?, listing_type = ?, description = ?, status = ?
            WHERE id = ?
        `, [name, email, phone, propertyType, address, bedrooms,
            bathrooms, area, price, listingType, description, status, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/properties/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM properties WHERE id = ?', id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting property:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/messages', authenticateAdmin, async (req, res) => {
    try {
        const messages = await db.all('SELECT * FROM contact_messages ORDER BY created_at DESC');
        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/messages/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM contact_messages WHERE id = ?', id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/subscribers', authenticateAdmin, async (req, res) => {
    try {
        const subscribers = await db.all('SELECT * FROM newsletter_subscriptions ORDER BY created_at DESC');
        res.json({ subscribers });
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/subscribers/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM newsletter_subscriptions WHERE id = ?', id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Example API endpoint for health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', date: new Date().toISOString() });
});

// Example API endpoint for test
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
});

// Handle admin routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

module.exports = app;