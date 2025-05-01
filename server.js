const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('client'));

// PostgreSQL connection - Use environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/utmebookdb',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Setup nodemailer for OTP emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
    pass: process.env.EMAIL_PASS || 'xego euqm xrjf mrks'
  }
});

// Store OTPs (in a production environment, use Redis or another solution)
const otpStore = {};

// Initialize database tables
async function initDB() {
  try {
    // Test database connection first
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Then create tables if needed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
    console.error('Please make sure your PostgreSQL database is running and accessible');
    console.error('Database URL:', process.env.DATABASE_URL ? 'Using environment variable' : 'Using localhost default');
  }
}

// Generate and send OTP
app.post('/api/send-otp', async (req, res) => {
  const { email, username } = req.body;
  
  try {
    // Check if email or username already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email or username already exists' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore[email] = {
      otp,
      username,
      expires: Date.now() + 5 * 60 * 1000
    };
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: 'UTMeBook Registration OTP',
      text: `Your OTP for UTMeBook registration is: ${otp}. This code will expire in 5 minutes.`
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to send OTP email' 
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'OTP sent successfully' 
      });
    });
    
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Verify OTP and register user
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp, password } = req.body;
  
  try {
    // Check if OTP exists and is valid
    const otpData = otpStore[email];
    
    if (!otpData || otpData.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    if (Date.now() > otpData.expires) {
      delete otpStore[email];
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired' 
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
      [otpData.username, email, hashedPassword]
    );
    
    // Clear OTP
    delete otpStore[email];
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully' 
    });
    
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Root route - Serve the main page
app.get('/', (req, res) => {
  res.sendFile('client/webpages/login.html', { root: './' });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    const user = result.rows[0];
    
    // Compare password
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // In a production environment, use JWT or sessions
    res.status(200).json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      } 
    });
    
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Add routes for all HTML pages
app.get('/login', (req, res) => {
  res.sendFile('client/webpages/login.html', { root: './' });
});

app.get('/register', (req, res) => {
  console.log('Handling /register route');
  res.sendFile('client/webpages/register.html', { root: './' });
});

app.get('/dashboard', (req, res) => {
  res.sendFile('client/webpages/dashboard.html', { root: './' });
});

// Catch-all route to handle any undefined routes
app.use((req, res) => {
  res.status(404).sendFile('client/webpages/login.html', { root: './' });
});

// Start server and initialize database
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDB();
});