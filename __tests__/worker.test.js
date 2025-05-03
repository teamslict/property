const fetch = require('node-fetch');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');

describe('Cloudflare Worker /api/properties', () => {
  const baseUrl = 'http://127.0.0.1:8787';
  let workerProcess;
  
  beforeAll(async () => {
    // Start the worker in the background
    return new Promise((resolve, reject) => {
      workerProcess = spawn('npx', ['wrangler', 'dev', '--port=8787', '--env', 'production'], {
        stdio: 'pipe',
        shell: true
      });

      // Handle worker output
      workerProcess.stdout.on('data', (data) => {
        console.log(`Worker stdout: ${data}`);
        if (data.toString().includes('Ready on http://127.0.0.1:8787')) {
          resolve();
        }
      });

      workerProcess.stderr.on('data', (data) => {
        console.error(`Worker stderr: ${data}`);
      });

      workerProcess.on('error', (err) => {
        console.error('Failed to start worker:', err);
        reject(err);
      });

      // Set a timeout in case worker doesn't start
      const timeout = setTimeout(() => {
        reject(new Error('Worker failed to start within timeout'));
      }, 20000);

      // Clear timeout if worker starts successfully
      workerProcess.stdout.on('data', (data) => {
        if (data.toString().includes('Ready on http://127.0.0.1:8787')) {
          clearTimeout(timeout);
        }
      });
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup: Kill the worker process and its children using tree-kill
    if (workerProcess && !workerProcess.killed) {
      return new Promise((resolve) => {
        treeKill(workerProcess.pid, 'SIGKILL', (err) => {
          if (err) {
            console.error('Error killing worker process:', err);
          }
          resolve();
        });
      });
    }
  });

  it('should list properties (GET)', async () => {
    const res = await fetch(`${baseUrl}/api/properties`, {
      headers: {
        'x-test-env': 'true'
      }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  }, 10000);  // 10 second timeout

  it('should return validation error for incomplete POST', async () => {
    const res = await fetch(`${baseUrl}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  }, 10000);

  it('should create a property (valid POST)', async () => {
    const property = {
      name: 'Test User',
      email: 'testuser@example.com',
      phone: '1234567890',
      propertyType: 'House',
      address: '123 Test St',
      bedrooms: 3,
      bathrooms: 2,
      area: 1200,
      price: 5000000,
      listingType: 'Sale',
      description: 'A test property.'
    };
    const res = await fetch(`${baseUrl}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property)
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  }, 10000);

  it('should create a property and list it (integration)', async () => {
    const property = {
      name: 'Integration Test User',
      email: 'integrationtest@example.com',
      phone: '9876543210',
      propertyType: 'Apartment',
      address: '456 Integration Ave',
      bedrooms: 2,
      bathrooms: 1,
      area: 800,
      price: 3000000,
      listingType: 'Sale',
      description: 'Integration test property.'
    };
    
    const postRes = await fetch(`${baseUrl}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property)
    });
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);

    const getRes = await fetch(`${baseUrl}/api/properties`, {
      headers: {
        'x-test-env': 'true'
      }
    });
    expect(getRes.status).toBe(200);
    const properties = await getRes.json();
    expect(Array.isArray(properties)).toBe(true);
  }, 15000);

  it('should create and verify a detailed property listing', async () => {
    const detailedProperty = {
      name: 'Sample Owner',
      email: 'owner@example.com',
      phone: '+94771234567',
      propertyType: 'Luxury Apartment',
      address: '42 Galle Road, Colombo 03',
      bedrooms: 4,
      bathrooms: 3,
      area: 2200,
      price: 75000000, // 75M LKR
      listingType: 'Sale',
      description: 'Luxurious 4-bedroom apartment with sea view, modern amenities, and 24/7 security',
      amenities: [
        'Swimming Pool',
        'Gym',
        'Parking',
        'Security',
        'Backup Power'
      ],
      location: {
        city: 'Colombo',
        district: 'Colombo',
        coordinates: {
          latitude: 6.9271,
          longitude: 79.8612
        }
      },
      photos: [
        'https://example.com/property1.jpg',
        'https://example.com/property2.jpg'
      ]
    };

    // Create property
    const postRes = await fetch(`${baseUrl}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailedProperty)
    });
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.id).toBeDefined();

    // Verify property in listing
    const getRes = await fetch(`${baseUrl}/api/properties`, {
      headers: {
        'x-test-env': 'true'
      }
    });
    expect(getRes.status).toBe(200);
    const properties = await getRes.json();
    expect(Array.isArray(properties)).toBe(true);

    // Find our property in the list
    const listedProperty = properties.find(p => 
      p.email === detailedProperty.email && 
      p.address === detailedProperty.address
    );
    
    expect(listedProperty).toBeDefined();
    expect(listedProperty.propertyType).toBe(detailedProperty.propertyType);
    expect(listedProperty.price).toBe(detailedProperty.price);
    expect(listedProperty.bedrooms).toBe(detailedProperty.bedrooms);
    expect(listedProperty.area).toBe(detailedProperty.area);
    expect(listedProperty.location.city).toBe(detailedProperty.location.city);
  }, 15000);
});