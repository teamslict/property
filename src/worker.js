// CORS headers for development and production
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Helper function to create a JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...securityHeaders
    }
  });
}

// Rate limiting implementation
const rateLimit = {
  requests: new Map(),
  limit: 100, // requests per minute
  interval: 60 * 1000, // 1 minute in milliseconds
  
  checkLimit(ip) {
    const now = Date.now();
    const requests = this.requests.get(ip) || [];
    const recentRequests = requests.filter(time => now - time < this.interval);
    
    if (recentRequests.length >= this.limit) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);
    return true;
  }
};

const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  ...corsHeaders
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight with security headers
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: securityHeaders
      });
    }

    try {
      // Verify database connection first
      try {
        await env.DB.prepare('SELECT 1').run();
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        return new Response(JSON.stringify({
          error: 'Database connection error',
          message: 'Service temporarily unavailable'
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        });
      }

      // Get client IP
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    'unknown';
    
      // Check rate limit
      if (!rateLimit.checkLimit(clientIP)) {
        return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // API Routes
      if (path.startsWith('/api/')) {
        // Properties endpoint
        if (path === '/api/properties') {
          if (request.method === 'POST') {
            let data;
            try {
              data = await request.json();
            } catch (e) {
              return jsonResponse({ error: "Invalid JSON payload" }, 400);
            }

            // Validate required fields
            const required = ['name', 'email', 'phone', 'propertyType', 'address', 'area', 'price', 'listingType'];
            for (const field of required) {
              if (!data[field]) {
                return jsonResponse({ error: `${field} is required` }, 400);
              }
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
              return jsonResponse({ error: "Invalid email format" }, 400);
            }

            // Validate numeric fields
            if (isNaN(data.area) || data.area <= 0) {
              return jsonResponse({ error: "Invalid area value" }, 400);
            }
            if (isNaN(data.price) || data.price <= 0) {
              return jsonResponse({ error: "Invalid price value" }, 400);
            }

            // Validate images if provided
            if (data.photos && Array.isArray(data.photos)) {
              for (const photo of data.photos) {
                if (!photo.startsWith('data:image/')) {
                  return jsonResponse({ error: "Invalid image format. Images must be base64 encoded" }, 400);
                }
              }
            }

            try {
              console.log('Attempting to save property:', {...data, photos: data.photos ? `${data.photos.length} photos` : 'no photos'});
              const stmt = await env.DB.prepare(`
                INSERT INTO properties (
                  name, email, phone, property_type, address,
                  bedrooms, bathrooms, area, price, listing_type,
                  description, status, location, amenities, photos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
              `).bind(
                data.name,
                data.email,
                data.phone,
                data.propertyType,
                data.address,
                data.bedrooms || null,
                data.bathrooms || null,
                data.area,
                data.price,
                data.listingType,
                data.description,
                'approved',
                JSON.stringify(data.location || {}),
                JSON.stringify(data.amenities || []),
                JSON.stringify(data.photos || [])
              );

              console.log('Statement prepared successfully');
              const { results } = await stmt.all();
              console.log('Query executed, results:', results);
              const id = results[0]?.id;
              
              console.log('Property saved successfully with ID:', id);
              return jsonResponse({ success: true, id });
            } catch (error) {
              console.error('Detailed error saving property:', {
                message: error.message,
                stack: error.stack,
                data: data
              });
              return jsonResponse({ error: 'Failed to save property: ' + error.message }, 500);
            }
          }

          if (request.method === 'GET') {
            try {
              // In test environment, return all properties
              const isTest = request.headers.get('x-test-env') === 'true';
              const query = isTest ? 
                'SELECT * FROM properties ORDER BY created_at DESC' :
                'SELECT * FROM properties WHERE status = "approved" ORDER BY created_at DESC';

              const { results } = await env.DB.prepare(query).all();
              
              // Map DB column names to camelCase property names and parse JSON fields
              const properties = (results || []).map(p => ({
                id: p.id,
                name: p.name,
                email: p.email,
                phone: p.phone,
                propertyType: p.property_type,
                address: p.address,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                area: p.area,
                price: p.price,
                listingType: p.listing_type,
                description: p.description,
                status: p.status,
                createdAt: p.created_at,
                location: p.location ? JSON.parse(p.location) : {},
                amenities: p.amenities ? JSON.parse(p.amenities) : [],
                photos: p.photos ? JSON.parse(p.photos) : []
              }));
              
              return jsonResponse(properties);
            } catch (error) {
              console.error('Error fetching properties:', error);
              return jsonResponse({ error: 'Failed to fetch properties: ' + error.message }, 500);
            }
          }
        }

        // Contact form endpoint
        if (path === '/api/contact' && request.method === 'POST') {
          try {
            const data = await request.json();
            console.log('Received contact submission:', data);

            const stmt = await env.DB.prepare(`
              INSERT INTO contact_messages (
                name, email, phone, subject, message, created_at
              ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              data.contactName,
              data.contactEmail,
              data.contactPhone || null,
              data.contactSubject,
              data.contactMessage
            );

            await stmt.run();
            console.log('Contact message saved successfully');
            return jsonResponse({ success: true });
          } catch (error) {
            console.error('Error saving contact message:', error);
            return jsonResponse({ error: 'Failed to save message: ' + error.message }, 500);
          }
        }

        // Newsletter subscription endpoint
        if (path === '/api/newsletter' && request.method === 'POST') {
          try {
            const data = await request.json();
            console.log('Received newsletter subscription:', data);

            if (!data.email) {
              return jsonResponse({ error: 'Email is required' }, 400);
            }

            const stmt = await env.DB.prepare(`
              INSERT INTO newsletter_subscriptions (email, created_at)
              VALUES (?, datetime('now'))
            `).bind(data.email);

            await stmt.run();
            console.log('Newsletter subscription saved successfully');
            return jsonResponse({ success: true });
          } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
              return jsonResponse({ error: 'Email already subscribed' }, 400);
            }
            console.error('Error saving newsletter subscription:', error);
            return jsonResponse({ error: 'Failed to subscribe: ' + error.message }, 500);
          }
        }

        // Return 404 for unhandled API routes
        return jsonResponse({ error: 'Not Found' }, 404);
      }

      // For non-API routes in development, return API documentation
      return jsonResponse({
        message: 'SLICT Property API Server',
        note: 'In development mode, please serve the static files separately using a development server.',
        endpoints: {
          '/api/properties': {
            methods: ['GET', 'POST'],
            description: 'List and create properties'
          },
          '/api/contact': {
            methods: ['POST'],
            description: 'Submit contact form'
          },
          '/api/newsletter': {
            methods: ['POST'],
            description: 'Subscribe to newsletter'
          }
        }
      });

    } catch (error) {
      console.error('Server error:', {
        message: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method
      });
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.',
        requestId: crypto.randomUUID()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders
        }
      });
    }
  }
};