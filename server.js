const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'your-production-domain.com' : 'http://localhost:3000',
  credentials: true
}));

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client')));

// PostgreSQL connection - Use environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/utmebookdb',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Setup nodemailer for OTP emails with more verbose error handling
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
    pass: process.env.EMAIL_PASS || 'xego euqm xrjf mrks'
  },
  debug: true // Enable debug logging
});

// Test email configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
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

// Generate and send OTP - Add better error handling and logging
app.post('/api/send-otp', async (req, res) => {
  const { email, username } = req.body;
  
  console.log(`Received OTP request for email: ${email}, username: ${username}`);
  
  try {
    // Check if email or username already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (userCheck.rows.length > 0) {
      console.log(`User already exists with email: ${email} or username: ${username}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Email or username already exists' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    console.log(`Generated OTP for ${email}: ${otp}`);
    
    // Store OTP with expiration (5 minutes)
    otpStore[email] = {
      otp,
      username,
      expires: Date.now() + 5 * 60 * 1000
    };
    
    // Send email with promise handling for better error tracking
    const mailOptions = {
      from: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
      to: email,
      subject: 'UTMeBook Registration OTP',
      text: `Your OTP for UTMeBook registration is: ${otp}. This code will expire in 5 minutes.`
    };
    
    console.log(`Attempting to send email to: ${email}`);
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
      
      res.status(200).json({ 
        success: true, 
        message: 'OTP sent successfully' 
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }
    
  } catch (err) {
    console.error('Server error in send-otp:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Verify OTP and register user
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp, password } = req.body;
  
  console.log(`Received OTP verification for email: ${email}`);
  
  try {
    // Check if OTP exists and is valid
    const otpData = otpStore[email];
    
    if (!otpData || otpData.otp !== otp) {
      console.log(`Invalid OTP for email: ${email}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    if (Date.now() > otpData.expires) {
      console.log(`Expired OTP for email: ${email}`);
      delete otpStore[email];
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired' 
      });
    }
    
    // If no password provided, just validate OTP and return success
    if (!password) {
      console.log(`OTP verified for email: ${email} (verification only)`);
      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully'
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
    
    console.log(`User registered successfully: ${email}`);
    
    // Clear OTP
    delete otpStore[email];
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully' 
    });
    
  } catch (err) {
    console.error('Server error in verify-otp:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Root route - Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/login.html'));
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`Login attempt for username: ${username}`);
  
  try {
    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      console.log(`No user found with username: ${username}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    const user = result.rows[0];
    
    // Compare password
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      console.log(`Invalid password for username: ${username}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    console.log(`User logged in successfully: ${username}`);
    
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
    console.error('Server error in login:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Add routes for all HTML pages - Use path.join for better cross-platform compatibility
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/login.html'));
});

app.get('/register', (req, res) => {
  console.log('Handling /register route');
  res.sendFile(path.join(__dirname, 'client/webpages/register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/dashboard.html'));
});

// Catch-all route to handle any undefined routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'client/webpages/login.html'));
});

// Start server and initialize database
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDB();
});