if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/utmebookdb_yja9',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});


//////////////////////////////////// [LOGIN & REGISTER ] ///////////////////////////////////
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
        role VARCHAR(50) DEFAULT 'public',
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
        email: user.email,
        role: user.role
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


// Add these endpoints after your existing login endpoints in server.js

// Request password reset
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  console.log(`Received password reset request for email: ${email}`);
  
  try {
    // Check if email exists in the database
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (userCheck.rows.length === 0) {
      console.log(`No user found with email: ${email}`);
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with that email address' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    console.log(`Generated password reset OTP for ${email}: ${otp}`);
    
    // Store OTP with expiration (5 minutes)
    otpStore[email] = {
      otp,
      type: 'password-reset',
      expires: Date.now() + 5 * 60 * 1000
    };
    
    // Send email with OTP
    const mailOptions = {
      from: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
      to: email,
      subject: 'UTMeBook Password Reset',
      text: `Your OTP for UTMeBook password reset is: ${otp}. This code will expire in 5 minutes.`
    };
    
    console.log(`Attempting to send password reset email to: ${email}`);
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', info.response);
      
      res.status(200).json({ 
        success: true, 
        message: 'Password reset OTP sent successfully' 
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send password reset email',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }
    
  } catch (err) {
    console.error('Server error in forgot-password:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Verify OTP and reset password
app.post('/api/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  
  console.log(`Received password reset verification for email: ${email}`);
  
  try {
    // Check if OTP exists and is valid
    const otpData = otpStore[email];
    
    if (!otpData || otpData.otp !== otp || otpData.type !== 'password-reset') {
      console.log(`Invalid OTP for password reset email: ${email}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    if (Date.now() > otpData.expires) {
      console.log(`Expired OTP for password reset email: ${email}`);
      delete otpStore[email];
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired' 
      });
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user's password in the database
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );
    
    console.log(`Password reset successfully for email: ${email}`);
    
    // Clear OTP
    delete otpStore[email];
    
    res.status(200).json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
    
  } catch (err) {
    console.error('Server error in reset-password:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [END LOGIN & REGISTER ] ///////////////////////////////////


//////////////////////////////////// [Add Book & Manage Order ] ///////////////////////////////////

// Add these imports after the existing ones in server.js
const multer = require('multer');
const fs = require('fs');

// Define storage directories - add these after the Express app initialization
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const COVERS_DIR = path.join(UPLOAD_DIR, 'covers');
const BOOKS_DIR = path.join(UPLOAD_DIR, 'books');

// Create directories if they don't exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(BOOKS_DIR, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on field name
    const dest = file.fieldname === 'coverImage' ? COVERS_DIR : BOOKS_DIR;
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file types
    if (file.fieldname === 'coverImage') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for cover image'));
      }
    } else if (file.fieldname === 'bookFile') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed for book upload'));
      }
    } else {
      cb(new Error('Unexpected field'));
    }
  }
});

// Add to initDB function - create books table
// Inside the initDB function, add this after the users table creation
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
        role VARCHAR(50) DEFAULT 'public',
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create books table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        description TEXT,
        cover_image_path VARCHAR(255),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Available',
        book_file_path VARCHAR(255),
        seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(15) NOT NULL,
        title VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        mac_address VARCHAR(20) NOT NULL,
        cover_image_path VARCHAR(255),
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        order_status VARCHAR(20) DEFAULT 'Pending',
        book_file_path VARCHAR(255),
        buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
        seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS purchases 
      ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)
    `);

    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        related_order_id VARCHAR(15),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS encrypted (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(15) NOT NULL,
        title VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cover_image_path VARCHAR(255),
        purchase_date TIMESTAMP,
        encrypted_book_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(20),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS publicMessages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message_type VARCHAR(20) NOT NULL,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        related_order_id VARCHAR(15),
        is_read BOOLEAN DEFAULT false,
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

// Add these API endpoints after existing ones

// API endpoint to add a new book
app.post('/api/books/add', upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), async (req, res) => {
  console.log('Received book upload request');
  console.log('Files received:', req.files); // Add this for debugging
  
  // Check if files are present
  if (!req.files || !req.files.coverImage || !req.files.bookFile) {
    return res.status(400).json({
      success: false,
      message: req.files ? 
        (!req.files.coverImage ? 'Please upload a cover image' : 'Please upload a book file (PDF)') : 
        'No files were uploaded'
    });
  }
  
  try {
    // Get form data
    const { title, category, price, description, status, sellerId } = req.body;
    
    // Get file paths
    const coverImagePath = req.files.coverImage[0].path.replace(/\\/g, '/');
    const bookFilePath = req.files.bookFile[0].path.replace(/\\/g, '/');
    
    // Store relative paths from the upload directory
    const relativeCoverPath = coverImagePath.replace(UPLOAD_DIR.replace(/\\/g, '/') + '/', '');
    const relativeBookPath = bookFilePath.replace(UPLOAD_DIR.replace(/\\/g, '/') + '/', '');
    
    console.log(`Adding book: ${title} by seller: ${sellerId}`);
    console.log(`Cover path: ${relativeCoverPath}`);
    console.log(`Book path: ${relativeBookPath}`);
    
    // Insert book into database
    const result = await pool.query(
      `INSERT INTO books (title, category, price, description, status, cover_image_path, book_file_path, seller_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title, category, price, description, status, relativeCoverPath, relativeBookPath, sellerId]
    );
    
    console.log(`Book added successfully with ID: ${result.rows[0].id}`);
    
    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      bookId: result.rows[0].id
    });
    
  } catch (err) {
    console.error('Error adding book:', err);
    
    // Clean up uploaded files if there was an error
    if (req.files) {
      if (req.files.coverImage) {
        fs.unlink(req.files.coverImage[0].path, (err) => {
          if (err) console.error('Error deleting cover image:', err);
        });
      }
      if (req.files.bookFile) {
        fs.unlink(req.files.bookFile[0].path, (err) => {
          if (err) console.error('Error deleting book file:', err);
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error adding book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to get new arrivals
app.get('/api/books/new-arrivals', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.category, b.price, b.status, b.upload_date, 
              b.cover_image_path, u.username as seller_name
       FROM books b
       JOIN users u ON b.seller_id = u.id
       WHERE b.status = 'Available'
       ORDER BY b.upload_date DESC
       LIMIT 10`
    );
    
    // Format the results
    const books = result.rows.map(book => ({
      id: book.id,
      title: book.title,
      category: book.category,
      price: parseFloat(book.price),
      status: book.status,
      uploadDate: book.upload_date,
      coverUrl: `/uploads/${book.cover_image_path}`,
      sellerName: book.seller_name
    }));
    
    res.status(200).json({
      success: true,
      books: books
    });
    
  } catch (err) {
    console.error('Error fetching new arrivals:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching new arrivals',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to get user's books (for My Sales section)
app.get('/api/books/my-sales/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT id, title, category, price, status, upload_date, cover_image_path
       FROM books
       WHERE seller_id = $1
       ORDER BY upload_date DESC`,
      [userId]
    );
    
    // Format the results
    const books = result.rows.map(book => ({
      id: book.id,
      title: book.title,
      category: book.category,
      price: parseFloat(book.price),
      status: book.status,
      uploadDate: book.upload_date,
      coverUrl: `/uploads/${book.cover_image_path}`
    }));
    
    res.status(200).json({
      success: true,
      books: books
    });
    
  } catch (err) {
    console.error(`Error fetching sales for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching your books',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to get user's purchases


// API endpoint to update a book
app.put('/api/books/:bookId', upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), async (req, res) => {
  const { bookId } = req.params;
  
  try {
    // Get form data
    const { title, category, price, description, status, sellerId } = req.body;
    
    // Verify that the book belongs to the seller
    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id = $1 AND seller_id = $2',
      [bookId, sellerId]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this book'
      });
    }
    
    const book = bookCheck.rows[0];
    
    // Build the update query
    let updateQuery = `
      UPDATE books
      SET title = $1, category = $2, price = $3, description = $4, status = $5
    `;
    
    let params = [title, category, price, description, status];
    let index = 6;
    
    // Update cover image if provided
    if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
      const coverImagePath = req.files.coverImage[0].path.replace(/\\/g, '/');
      const relativeCoverPath = coverImagePath.replace(UPLOAD_DIR.replace(/\\/g, '/') + '/', '');
      
      updateQuery += `, cover_image_path = $${index}`;
      params.push(relativeCoverPath);
      index++;
      
      // Delete old cover image
      if (book.cover_image_path) {
        fs.unlink(path.join(UPLOAD_DIR, book.cover_image_path), (err) => {
          if (err) console.error('Error deleting old cover image:', err);
        });
      }
    }
    
    // Update book file if provided
    if (req.files && req.files.bookFile && req.files.bookFile.length > 0) {
      const bookFilePath = req.files.bookFile[0].path.replace(/\\/g, '/');
      const relativeBookPath = bookFilePath.replace(UPLOAD_DIR.replace(/\\/g, '/') + '/', '');
      
      updateQuery += `, book_file_path = $${index}`;
      params.push(relativeBookPath);
      index++;
      
      // Delete old book file
      if (book.book_file_path) {
        fs.unlink(path.join(UPLOAD_DIR, book.book_file_path), (err) => {
          if (err) console.error('Error deleting old book file:', err);
        });
      }
    }
    
    // Complete the query
    updateQuery += ` WHERE id = $${index} RETURNING id`;
    params.push(bookId);
    
    // Debug the query and parameters
    console.log('Update query:', updateQuery);
    console.log('Parameters:', params);
    
    // Execute the update
    const result = await pool.query(updateQuery, params);
    
    res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      bookId: result.rows[0].id
    });
    
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to delete a book
app.delete('/api/books/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const { sellerId } = req.query;
  
  try {
    // Verify that the book belongs to the seller
    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id = $1 AND seller_id = $2',
      [bookId, sellerId]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this book'
      });
    }
    
    const book = bookCheck.rows[0];
    
    // Delete the book from the database
    await pool.query('DELETE FROM books WHERE id = $1', [bookId]);
    
    // Delete files
    if (book.cover_image_path) {
      fs.unlink(path.join(UPLOAD_DIR, book.cover_image_path), (err) => {
        if (err) console.error('Error deleting cover image:', err);
      });
    }
    
    if (book.book_file_path) {
      fs.unlink(path.join(UPLOAD_DIR, book.book_file_path), (err) => {
        if (err) console.error('Error deleting book file:', err);
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Book deleted successfully'
    });
    
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// Also add the API endpoint to fetch individual book details
app.get('/api/books/:bookId', async (req, res) => {
  const { bookId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.category, b.price, b.description, b.status, 
              b.upload_date, b.cover_image_path, u.username as seller_name
       FROM books b
       JOIN users u ON b.seller_id = u.id
       WHERE b.id = $1`,
      [bookId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    // Format the result
    const book = result.rows[0];
    const formattedBook = {
      id: book.id,
      title: book.title,
      category: book.category,
      price: parseFloat(book.price),
      description: book.description || '',
      status: book.status,
      uploadDate: book.upload_date,
      coverUrl: `/uploads/${book.cover_image_path}`,
      sellerName: book.seller_name
    };
    
    res.status(200).json({
      success: true,
      book: formattedBook
    });
    
  } catch (err) {
    console.error(`Error fetching book with ID ${bookId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching book details',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [END Add Book & Manage Order ] ///////////////////////////////////


//////////////////////////////////// [PlaceOrder(STRIPE) & Message Control ] ///////////////////////////////////

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


// API endpoint to place an order
app.post('/api/purchases/place-order', async (req, res) => {
  try {
    // Get order information
    const { 
      bookId, 
      buyerId, 
      paymentMethod, 
      macAddress,
      paymentIntentId 
    } = req.body;
    
    // Fetch book information
    const bookResult = await pool.query(
      `SELECT * FROM books WHERE id = $1 AND status = 'Available'`,
      [bookId]
    );
    
    if (bookResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Book is not available for purchase'
      });
    }
    
    const book = bookResult.rows[0];
    
    // Generate order ID
    const timestamp = Date.now().toString().slice(-6);
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderId = `UTM${timestamp}${randomDigits}`;
    
    // Get buyer information
    const buyerResult = await pool.query(
      `SELECT username, email FROM users WHERE id = $1`,
      [buyerId]
    );
    
    const buyer = buyerResult.rows[0];
    
    // Insert purchase record
    const purchaseResult = await pool.query(
      `INSERT INTO purchases (
        order_id, title, category, price, payment_method, mac_address,
        cover_image_path, book_file_path, buyer_id, book_id, seller_id,
        payment_intent_id, order_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        orderId,
        book.title,
        book.category,
        book.price,
        paymentMethod,
        macAddress,
        book.cover_image_path,
        book.book_file_path,
        buyerId,
        bookId,
        book.seller_id,
        paymentIntentId || null,
        'Pending'
      ]
    );
    
    // Always update book status to Sold, regardless of payment method
    await pool.query(
      `UPDATE books SET status = 'Sold' WHERE id = $1`,
      [bookId]
    );
    
    // Create message for admin users
    const admins = await pool.query(
      `SELECT id, email FROM users WHERE role = 'admin'`
    );
    
    // Insert messages for all admin users
    const messagePromises = admins.rows.map(admin => {
      return pool.query(
        `INSERT INTO messages (
          sender_id, recipient_id, subject, content, related_order_id
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          buyerId,
          admin.id,
          `New Order: ${orderId}`,
          `A new purchase has been made:\n\nOrder ID: ${orderId}\nBook: ${book.title}\nBuyer: ${buyer.username}\nPayment Method: ${paymentMethod}\nPayment Intent: ${paymentIntentId || 'N/A'}`,
          orderId
        ]
      );
    });
    
    await Promise.all(messagePromises);
    
    // Send email notifications to all admins
    const emailPromises = admins.rows.map(admin => {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
        to: admin.email,
        subject: `UTMeBook - New Order Pending Verification: ${orderId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Order Pending Verification</h2>
            <p>A new book purchase has been made and is waiting for your verification.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0066cc; margin-top: 0;">Order Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Order ID:</strong></td>
                  <td>${orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Book Title:</strong></td>
                  <td>${book.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Category:</strong></td>
                  <td>${book.category}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Price:</strong></td>
                  <td>RM${book.price}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Buyer:</strong></td>
                  <td>${buyer.username} (${buyer.email})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Payment Method:</strong></td>
                  <td>${paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>MAC Address:</strong></td>
                  <td>${macAddress}</td>
                </tr>
              </table>
            </div>
            
            <p>Please log in to the admin panel to verify and process this order.</p>
            
            <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                This is an automated message from UTMeBook. Please do not reply to this email.
              </p>
            </div>
          </div>
        `
      };
      
      return transporter.sendMail(mailOptions);
    });
    
    // Send emails without blocking the response
    Promise.all(emailPromises).catch(error => {
      console.error('Error sending admin notification emails:', error);
    });
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      orderId: orderId
    });
    
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({
      success: false,
      message: 'Error placing order',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});



// Add this new endpoint below your existing API endpoints
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    // Send client secret to client
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});




// API endpoint to get user's purchases
app.get('/api/purchases/my-purchases/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT p.id, p.order_id, p.title, p.category, p.price, p.payment_method,
              p.mac_address, p.purchase_date, p.order_status, p.cover_image_path,
              u.username as seller_name
       FROM purchases p
       JOIN users u ON p.seller_id = u.id
       WHERE p.buyer_id = $1
       ORDER BY p.purchase_date DESC`,
      [userId]
    );
    
    // Format the results
    const purchases = result.rows.map(purchase => ({
      id: purchase.id,
      orderId: purchase.order_id,
      title: purchase.title,
      category: purchase.category,
      price: parseFloat(purchase.price),
      paymentMethod: purchase.payment_method,
      macAddress: purchase.mac_address,
      purchaseDate: purchase.purchase_date,
      status: purchase.order_status,
      coverUrl: `/uploads/${purchase.cover_image_path}`,
      sellerName: purchase.seller_name
    }));
    
    res.status(200).json({
      success: true,
      purchases: purchases
    });
    
  } catch (err) {
    console.error(`Error fetching purchases for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching your purchases',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to cancel an order
app.put('/api/purchases/cancel/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { userId } = req.body;
  
  try {
    // Verify the order belongs to the user
    const orderCheck = await pool.query(
      'SELECT * FROM purchases WHERE order_id = $1 AND buyer_id = $2',
      [orderId, userId]
    );
    
    if (orderCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this order'
      });
    }
    
    const purchase = orderCheck.rows[0];
    
    // Check if the order is already delivered or canceled
    if (purchase.order_status === 'Delivered' || purchase.order_status === 'Canceled') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order that is already ${purchase.order_status.toLowerCase()}`
      });
    }
    
    // Update purchase status to Canceled
    await pool.query(
      `UPDATE purchases SET order_status = 'Canceled' WHERE order_id = $1`,
      [orderId]
    );
    
    // Update book status back to Available
    await pool.query(
      `UPDATE books SET status = 'Available' WHERE id = $1`,
      [purchase.book_id]
    );
    
    // Create message for admin users about the cancellation
    const admins = await pool.query(
      `SELECT id FROM users WHERE role = 'admin'`
    );
    
    // Insert messages for all admin users
    const messagePromises = admins.rows.map(admin => {
      return pool.query(
        `INSERT INTO messages (
          sender_id, recipient_id, subject, content, related_order_id
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          admin.id,
          `Order Canceled: ${orderId}`,
          `An order has been canceled:\n\nOrder ID: ${orderId}\nBook: ${purchase.title}\nPrice: RM${purchase.price}`,
          orderId
        ]
      );
    });
    
    await Promise.all(messagePromises);
    
    res.status(200).json({
      success: true,
      message: 'Order canceled successfully'
    });
    
  } catch (err) {
    console.error(`Error canceling order ${orderId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error canceling order',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to update MAC address for a purchase
app.put('/api/purchases/update-mac/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { userId, macAddress } = req.body;
  
  try {
    // Verify the order belongs to the user
    const orderCheck = await pool.query(
      'SELECT * FROM purchases WHERE order_id = $1 AND buyer_id = $2',
      [orderId, userId]
    );
    
    if (orderCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this order'
      });
    }
    
    // Update MAC address
    await pool.query(
      `UPDATE purchases SET mac_address = $1 WHERE order_id = $2`,
      [macAddress, orderId]
    );
    
    res.status(200).json({
      success: true,
      message: 'MAC address updated successfully'
    });
    
  } catch (err) {
    console.error(`Error updating MAC address for order ${orderId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error updating MAC address',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// API endpoint to get user's messages
app.get('/api/messages/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT m.id, m.subject, m.content, m.related_order_id, m.is_read, m.created_at,
              u.username as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.recipient_id = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );
    
    // Format the results
    const messages = result.rows.map(message => ({
      id: message.id,
      subject: message.subject,
      content: message.content,
      relatedOrderId: message.related_order_id,
      isRead: message.is_read,
      createdAt: message.created_at,
      senderName: message.sender_name
    }));
    
    res.status(200).json({
      success: true,
      messages: messages
    });
    
  } catch (err) {
    console.error(`Error fetching messages for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching your messages',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to mark a message as read
app.put('/api/messages/:messageId/read', async (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;
  
  try {
    // Verify the message belongs to the user
    const messageCheck = await pool.query(
      'SELECT * FROM messages WHERE id = $1 AND recipient_id = $2',
      [messageId, userId]
    );
    
    if (messageCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark this message as read'
      });
    }
    
    // Update message as read
    await pool.query(
      `UPDATE messages SET is_read = true WHERE id = $1`,
      [messageId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
    
  } catch (err) {
    console.error(`Error marking message ${messageId} as read:`, err);
    res.status(500).json({
      success: false,
      message: 'Error marking message as read',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to get purchase details for admin
app.get('/api/admin/purchases', async (req, res) => {
  const { userId } = req.query;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [userId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view all purchases'
      });
    }
    
    const result = await pool.query(
      `SELECT p.id, p.order_id, p.title, p.category, p.price, p.payment_method,
              p.mac_address, p.purchase_date, p.order_status, p.cover_image_path,
              p.book_id, p.book_file_path,
              b.username as buyer_name, s.username as seller_name
       FROM purchases p
       JOIN users b ON p.buyer_id = b.id
       JOIN users s ON p.seller_id = s.id
       ORDER BY p.purchase_date DESC`
    );
    
    // Format the results
    const purchases = result.rows.map(purchase => ({
      id: purchase.id,
      orderId: purchase.order_id,
      title: purchase.title,
      category: purchase.category,
      price: parseFloat(purchase.price),
      paymentMethod: purchase.payment_method,
      macAddress: purchase.mac_address,
      purchaseDate: purchase.purchase_date,
      status: purchase.order_status,
      coverUrl: `/uploads/${purchase.cover_image_path}`,
      bookId: purchase.book_id,
      bookFilePath: purchase.book_file_path,
      buyerName: purchase.buyer_name,
      sellerName: purchase.seller_name
    }));
    
    res.status(200).json({
      success: true,
      purchases: purchases
    });
    
  } catch (err) {
    console.error('Error fetching all purchases:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


//////////////////////////////////// [END PlaceOrder(STRIPE) & Message Control ] ///////////////////////////////////


//////////////////////////////////// [ADMIN CONTROL ] ///////////////////////////////////

// API endpoint for admin to update purchase status
app.put('/api/admin/purchases/update-status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { userId, newStatus, encryptFile, sendNotification } = req.body;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [userId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update order status'
      });
    }
    
    // Get purchase details
    const purchaseResult = await pool.query(
      'SELECT * FROM purchases WHERE order_id = $1',
      [orderId]
    );
    
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }
    
    const purchase = purchaseResult.rows[0];
    
    // Update purchase status
    await pool.query(
      `UPDATE purchases SET order_status = $1 WHERE order_id = $2`,
      [newStatus, orderId]
    );
    
    // If status is changed to Delivered and encryption is requested, encrypt the file
    let encrypted = false;
    if (newStatus === 'Delivered' && encryptFile) {
      try {
        // Get the book file path
        const bookFilePath = path.join(UPLOAD_DIR, purchase.book_file_path);
        
        // Check if file exists
        if (fs.existsSync(bookFilePath)) {
          // Read the PDF file
          const pdfData = fs.readFileSync(bookFilePath);
          
          // Get MAC address for encryption
          const macAddress = purchase.mac_address;
          
          // Modern encryption using createCipheriv
          const algorithm = 'aes-256-cbc';
          // Create a key of the correct length (32 bytes for aes-256)
          const key = crypto.scryptSync(macAddress, 'salt', 32);
          // Generate a random initialization vector
          const iv = crypto.randomBytes(16);
          
          // Create cipher with key and iv
          const cipher = crypto.createCipheriv(algorithm, key, iv);
          let encrypted = cipher.update(pdfData);
          encrypted = Buffer.concat([iv, encrypted, cipher.final()]); // Prepend IV to encrypted data
          
          // Create encryptedPDF directory if it doesn't exist
          const encryptedPDFDir = path.join(UPLOAD_DIR, 'encryptedPDF');
          fs.mkdirSync(encryptedPDFDir, { recursive: true });
          
          // Generate encrypted file path
          const encryptedFileName = `encrypted-${orderId}-${Date.now()}.pdf`;
          const encryptedFilePath = path.join(encryptedPDFDir, encryptedFileName);
          
          // Write encrypted data to file
          fs.writeFileSync(encryptedFilePath, encrypted);
          
          // Save encrypted file info to database (also store algorithm and salt info for future decryption)
          await pool.query(
            `INSERT INTO encrypted (
              order_id, title, category, price, cover_image_path,
              purchase_date, encrypted_book_path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              orderId,
              purchase.title,
              purchase.category,
              purchase.price,
              purchase.cover_image_path,
              purchase.purchase_date,
              `encryptedPDF/${encryptedFileName}`
            ]
          );
          
          encrypted = true;
        } else {
          console.error(`Book file not found at path: ${bookFilePath}`);
        }
      } catch (err) {
        console.error('Error encrypting file:', err);
      }
    }
    
    // If status is changed to Canceled, update book status back to Available
    if (newStatus === 'Canceled') {
      await pool.query(
        `UPDATE books SET status = 'Available' WHERE id = $1`,
        [purchase.book_id]
      );
    }
    
    // Get the buyer's information
    const buyerResult = await pool.query(
      'SELECT username, email FROM users WHERE id = $1',
      [purchase.buyer_id]
    );
    
    if (buyerResult.rows.length > 0) {
      const buyer = buyerResult.rows[0];
      
      // If sendNotification is true, send a notification to the buyer
      if (sendNotification) {
        // Prepare notification content based on the new status
        let title = '';
        let content = '';
        
        switch (newStatus) {
          case 'Processing':
            title = `Order ${orderId} is being processed`;
            content = `Dear ${buyer.username},\n\nYour order for "${purchase.title}" is now being processed. We'll notify you when your order is ready for download.\n\nOrder ID: ${orderId}\nBook: ${purchase.title}\nPrice: RM${purchase.price}\n\nThank you for your purchase!`;
            break;
          case 'Delivered':
            title = `Order ${orderId} is ready for download`;
            content = `Dear ${buyer.username},\n\nGreat news! Your order for "${purchase.title}" is now ready for download. You can access your purchase from the "My Book" section or directly from your orders page.\n\nOrder ID: ${orderId}\nBook: ${purchase.title}\nPrice: RM${purchase.price}\n\nThe book has been encrypted with your device's MAC address for security. Thank you for your purchase!`;
            break;
          case 'Canceled':
            title = `Order ${orderId} has been canceled`;
            content = `Dear ${buyer.username},\n\nYour order for "${purchase.title}" has been canceled.\n\nOrder ID: ${orderId}\nBook: ${purchase.title}\nPrice: RM${purchase.price}\n\nIf you did not request this cancellation or have any questions, please contact our support team.`;
            break;
          default:
            title = `Order ${orderId} status updated`;
            content = `Dear ${buyer.username},\n\nYour order for "${purchase.title}" has been updated to status: ${newStatus}.\n\nOrder ID: ${orderId}\nBook: ${purchase.title}\nPrice: RM${purchase.price}\n\nThank you for your purchase!`;
        }
        
        // Insert notification into publicMessages table
        await pool.query(
          `INSERT INTO publicMessages (
            user_id, message_type, title, content, related_order_id, is_read
          )
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [purchase.buyer_id, 'order', title, content, orderId, false]
        );
      }
      
      // Send email notification to buyer
      let emailSubject = '';
      let emailHtml = '';
      
      switch (newStatus) {
        case 'Delivered':
          emailSubject = `UTMeBook - Your Order ${orderId} is Ready for Download!`;
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Your Order is Ready!</h2>
              <p>Dear ${buyer.username},</p>
              <p>Great news! Your purchased book has been verified by our admin and is now ready for download.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0066cc; margin-top: 0;">Order Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Order ID:</strong></td>
                    <td>${orderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Book Title:</strong></td>
                    <td>${purchase.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Category:</strong></td>
                    <td>${purchase.category}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Price:</strong></td>
                    <td>RM${purchase.price}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Status:</strong></td>
                    <td style="color: #28a745; font-weight: bold;">Delivered</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1976d2; margin-top: 0;">How to Download Your Book:</h3>
                <ol>
                  <li>Log in to your UTMeBook account</li>
                  <li>Go to "My Book" section</li>
                  <li>Find your order and click "Download"</li>
                  <li>Your book will be downloaded in encrypted format</li>
                  <li>Use UTMeBook PDF Reader to open the encrypted book</li>
                </ol>
                <p><strong>Note:</strong> The book has been encrypted with your device's MAC address for security purposes.</p>
              </div>
              
              <p>Thank you for your purchase!</p>
              
              <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  This is an automated message from UTMeBook. Please do not reply to this email.
                </p>
              </div>
            </div>
          `;
          break;
          
        case 'Canceled':
          emailSubject = `UTMeBook - Order ${orderId} Canceled`;
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Order Canceled</h2>
              <p>Dear ${buyer.username},</p>
              <p>Your order has been canceled by the administrator.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #dc3545; margin-top: 0;">Order Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Order ID:</strong></td>
                    <td>${orderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Book Title:</strong></td>
                    <td>${purchase.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Price:</strong></td>
                    <td>RM${purchase.price}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Status:</strong></td>
                    <td style="color: #dc3545; font-weight: bold;">Canceled</td>
                  </tr>
                </table>
              </div>
              
              <p>If you did not request this cancellation or have any questions, please contact our support team.</p>
              
              <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  This is an automated message from UTMeBook. Please do not reply to this email.
                </p>
              </div>
            </div>
          `;
          break;
          
        default:
          // For other status updates (Processing, etc.)
          emailSubject = `UTMeBook - Order ${orderId} Status Update`;
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Order Status Updated</h2>
              <p>Dear ${buyer.username},</p>
              <p>Your order status has been updated.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0066cc; margin-top: 0;">Order Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Order ID:</strong></td>
                    <td>${orderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Book Title:</strong></td>
                    <td>${purchase.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Price:</strong></td>
                    <td>RM${purchase.price}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Status:</strong></td>
                    <td style="font-weight: bold;">${newStatus}</td>
                  </tr>
                </table>
              </div>
              
              <p>Thank you for your patience!</p>
              
              <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  This is an automated message from UTMeBook. Please do not reply to this email.
                </p>
              </div>
            </div>
          `;
      }
      
      // Send email to buyer
      const mailOptions = {
        from: process.env.EMAIL_USER || 'gengcangkui@gmail.com',
        to: buyer.email,
        subject: emailSubject,
        html: emailHtml
      };
      
      // Send email without blocking the response
      transporter.sendMail(mailOptions).catch(error => {
        console.error('Error sending buyer notification email:', error);
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      encrypted: encrypted
    });
    
  } catch (err) {
    console.error(`Error updating status for order ${orderId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [ END ADMIN CONTROL ] ///////////////////////////////////


//////////////////////////////////// [ ADMIN UserBookManager ] ///////////////////////////////////

// API endpoint to get all users
app.get('/api/admin/users', async (req, res) => {
  const { userId } = req.query;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [userId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view users'
      });
    }
    
    // Get all users
    const result = await pool.query(
      `SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC`
    );
    
    res.status(200).json({
      success: true,
      users: result.rows
    });
    
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to add a new user
app.post('/api/admin/users/add', async (req, res) => {
  const { username, email, role, password, adminId } = req.body;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [adminId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add users'
      });
    }
    
    // Check if username or email already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    await pool.query(
      'INSERT INTO users (username, email, role, password) VALUES ($1, $2, $3, $4)',
      [username, email, role, hashedPassword]
    );
    
    res.status(201).json({
      success: true,
      message: 'User added successfully'
    });
    
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({
      success: false,
      message: 'Error adding user',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to delete a user
app.delete('/api/admin/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { adminId } = req.query;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [adminId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete users'
      });
    }
    
    // Check if user exists and is not an admin
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userCheck.rows[0];
    
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }
    
    // Delete user
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint for admin to delete any book
app.delete('/api/admin/books/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const { adminId } = req.query;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [adminId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this book'
      });
    }
    
    // Get book info before deletion (for file cleanup)
    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    const book = bookCheck.rows[0];
    
    // Delete the book from the database
    await pool.query('DELETE FROM books WHERE id = $1', [bookId]);
    
    // Delete files
    if (book.cover_image_path) {
      fs.unlink(path.join(UPLOAD_DIR, book.cover_image_path), (err) => {
        if (err) console.error('Error deleting cover image:', err);
      });
    }
    
    if (book.book_file_path) {
      fs.unlink(path.join(UPLOAD_DIR, book.book_file_path), (err) => {
        if (err) console.error('Error deleting book file:', err);
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Book deleted successfully'
    });
    
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [ END ADMIN UserBookManager ] ///////////////////////////////////



//////////////////////////////////// [ DOWNLOAD ] ///////////////////////////////////


// API endpoint to download a book
app.get('/api/books/download/:bookId', async (req, res) => {
  const { bookId } = req.params;
  
  try {
    // Get book info
    const bookResult = await pool.query(
      'SELECT * FROM books WHERE id = $1',
      [bookId]
    );
    
    if (bookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    const book = bookResult.rows[0];
    const filePath = path.join(UPLOAD_DIR, book.book_file_path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Book file not found'
      });
    }
    
    // Return download URL
    res.json({
      success: true,
      downloadUrl: `/uploads/${book.book_file_path}`
    });
    
  } catch (err) {
    console.error('Error downloading book:', err);
    res.status(500).json({
      success: false,
      message: 'Error downloading book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


//////////////////////////////////// [ END DOWNLOAD ] ///////////////////////////////////


//////////////////////////////////// [ DOWNLOAD ORDERS & MyBOOK ] ///////////////////////////////////
// Improved API endpoint to download an encrypted book
app.get('/api/encrypted/download/:orderId', async (req, res) => {
  const { orderId } = req.params;
  
  console.log(`Download request for order ID: ${orderId}`); // Add logging
  
  try {
    // Get encrypted book info
    const encryptedResult = await pool.query(
      'SELECT * FROM encrypted WHERE order_id = $1',
      [orderId]
    );
    
    if (encryptedResult.rows.length === 0) {
      console.log(`No encrypted record found for order ID: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Encrypted book not found in database'
      });
    }
    
    const encryptedBook = encryptedResult.rows[0];
    const filePath = path.join(UPLOAD_DIR, encryptedBook.encrypted_book_path);
    console.log(`Looking for file at path: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`File not found at path: ${filePath}`);
      
      // If the encrypted file doesn't exist, try to encrypt it now
      try {
        // Get the purchase record to get the book file path and MAC address
        const purchaseResult = await pool.query(
          'SELECT * FROM purchases WHERE order_id = $1',
          [orderId]
        );
        
        if (purchaseResult.rows.length > 0) {
          const purchase = purchaseResult.rows[0];
          
          // Only attempt to encrypt if the purchase is in 'Delivered' status
          if (purchase.order_status === 'Delivered') {
            // Get the book file path
            const bookFilePath = path.join(UPLOAD_DIR, purchase.book_file_path);
            
            if (fs.existsSync(bookFilePath)) {
              // Read the PDF file
              const pdfData = fs.readFileSync(bookFilePath);
              
              // Get MAC address for encryption
              const macAddress = purchase.mac_address;
              
              // Modern encryption using createCipheriv
              const algorithm = 'aes-256-cbc';
              // Create a key of the correct length (32 bytes for aes-256)
              const key = crypto.scryptSync(macAddress, 'salt', 32);
              // Generate a random initialization vector
              const iv = crypto.randomBytes(16);
              
              // Create cipher with key and iv
              const cipher = crypto.createCipheriv(algorithm, key, iv);
              let encrypted = cipher.update(pdfData);
              encrypted = Buffer.concat([iv, encrypted, cipher.final()]); // Prepend IV to encrypted data
              
              // Create encryptedPDF directory if it doesn't exist
              const encryptedPDFDir = path.join(UPLOAD_DIR, 'encryptedPDF');
              fs.mkdirSync(encryptedPDFDir, { recursive: true });
              
              // Generate encrypted file path
              const encryptedFileName = `encrypted-${orderId}-${Date.now()}.pdf`;
              const encryptedFilePath = path.join(encryptedPDFDir, encryptedFileName);
              
              // Write encrypted data to file
              fs.writeFileSync(encryptedFilePath, encrypted);
              
              // Update database record with new path
              const relativeEncryptedPath = `encryptedPDF/${encryptedFileName}`;
              await pool.query(
                `UPDATE encrypted SET encrypted_book_path = $1 WHERE order_id = $2`,
                [relativeEncryptedPath, orderId]
              );
              
              console.log(`File re-encrypted successfully at: ${encryptedFilePath}`);
              
              // Return download URL for the newly encrypted file
              return res.json({
                success: true,
                downloadUrl: `/uploads/${relativeEncryptedPath}`
              });
            }
          }
        }
      } catch (encryptErr) {
        console.error('Error re-encrypting file:', encryptErr);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Encrypted book file not found and could not be recreated'
      });
    }
    
    // Return download URL if file exists
    res.json({
      success: true,
      downloadUrl: `/uploads/${encryptedBook.encrypted_book_path}`
    });
    
  } catch (err) {
    console.error('Error downloading encrypted book:', err);
    res.status(500).json({
      success: false,
      message: 'Error downloading encrypted book',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [ END DOWNLOAD ORDERS & MyBOOK ] ///////////////////////////////////


//////////////////////////////////// [ Users & Admin Account ] ///////////////////////////////////

// API endpoint to get user profile
app.get('/api/users/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // First check if the user exists
    const userResult = await pool.query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Then get the profile data
    const profileResult = await pool.query(
      'SELECT phone, address FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    const userData = userResult.rows[0];
    let profileData = {};
    
    if (profileResult.rows.length > 0) {
      profileData = profileResult.rows[0];
    }
    
    res.status(200).json({
      success: true,
      profile: {
        username: userData.username,
        email: userData.email,
        role: userData.role,
        phone: profileData.phone || '',
        address: profileData.address || ''
      }
    });
    
  } catch (err) {
    console.error(`Error fetching profile for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to update user profile
app.put('/api/users/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  const { username, email, phone, address } = req.body;
  
  try {
    // First check if the user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if username is already taken by another user
    if (username) {
      const usernameCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, userId]
      );
      
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }
    
    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email is already associated with another account'
        });
      }
    }
    
    // Update user data
    await pool.query(
      'UPDATE users SET username = $1, email = $2 WHERE id = $3',
      [username, email, userId]
    );
    
    // Check if profile exists
    const profileCheck = await pool.query(
      'SELECT user_id FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileCheck.rows.length === 0) {
      // Insert new profile
      await pool.query(
        'INSERT INTO user_profiles (user_id, phone, address) VALUES ($1, $2, $3)',
        [userId, phone, address]
      );
    } else {
      // Update existing profile
      await pool.query(
        'UPDATE user_profiles SET phone = $1, address = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3',
        [phone, address, userId]
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
    
  } catch (err) {
    console.error(`Error updating profile for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to change password
app.put('/api/users/:userId/change-password', async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  try {
    // First check if the user exists and get current password
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (err) {
    console.error(`Error changing password for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [ END Users & Admin Account ] ///////////////////////////////////


//////////////////////////////////// [PUBLIC MESSAGES ENDPOINTS] ///////////////////////////////////

// API endpoint to get user's public messages (notifications)
app.get('/api/public-messages/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT id, user_id, message_type, title, content, related_order_id, 
              is_read, created_at
       FROM publicMessages
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // Format the results
    const notifications = result.rows.map(notification => ({
      id: notification.id,
      userId: notification.user_id,
      messageType: notification.message_type,
      title: notification.title,
      content: notification.content,
      relatedOrderId: notification.related_order_id,
      isRead: notification.is_read,
      createdAt: notification.created_at
    }));
    
    res.status(200).json({
      success: true,
      notifications: notifications
    });
    
  } catch (err) {
    console.error(`Error fetching public messages for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error fetching your notifications',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to mark a public message as read
app.put('/api/public-messages/:messageId/read', async (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;
  
  try {
    // Verify the message belongs to the user
    const messageCheck = await pool.query(
      'SELECT * FROM publicMessages WHERE id = $1 AND user_id = $2',
      [messageId, userId]
    );
    
    if (messageCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark this message as read'
      });
    }
    
    // Update message as read
    await pool.query(
      `UPDATE publicMessages SET is_read = true WHERE id = $1`,
      [messageId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
    
  } catch (err) {
    console.error(`Error marking public message ${messageId} as read:`, err);
    res.status(500).json({
      success: false,
      message: 'Error marking message as read',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to mark all public messages as read
app.put('/api/public-messages/mark-all-read', async (req, res) => {
  const { userId } = req.body;
  
  try {
    // Update all messages as read
    await pool.query(
      `UPDATE publicMessages SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    
    res.status(200).json({
      success: true,
      message: 'All messages marked as read'
    });
    
  } catch (err) {
    console.error(`Error marking all public messages as read for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error marking all messages as read',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API endpoint to get unread message count
app.get('/api/public-messages/:userId/unread-count', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM publicMessages WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    
    res.status(200).json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
    
  } catch (err) {
    console.error(`Error getting unread count for user ${userId}:`, err);
    res.status(500).json({
      success: false,
      message: 'Error getting unread count',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [END PUBLIC MESSAGES ENDPOINTS] ///////////////////////////////////

//////////////////////////////////// [ ACTIVITY REPORT ] ///////////////////////////////////

// API endpoint to get activity report data
app.get('/api/admin/activity-report', async (req, res) => {
  const { userId, year, month } = req.query;
  
  try {
    // Verify user is an admin
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [userId, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view activity reports'
      });
    }
    
    // Set date range for the selected month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // Get new user registrations for the month
    const userRegistrations = await pool.query(
      `SELECT COUNT(*) as count, DATE(created_at) as date
       FROM users
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate, endDate]
    );
    
    // Get total users registered in the month
    const totalUsers = await pool.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );
    
    // Get books uploaded in the month
    const booksUploaded = await pool.query(
      `SELECT COUNT(*) as count, DATE(created_at) as date
       FROM books
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate, endDate]
    );
    
    // Get total books uploaded in the month
    const totalBooks = await pool.query(
      `SELECT COUNT(*) as count
       FROM books
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );
    
    // Get purchases made in the month
    const purchases = await pool.query(
      `SELECT COUNT(*) as count, DATE(purchase_date) as date
       FROM purchases
       WHERE purchase_date >= $1 AND purchase_date <= $2
       GROUP BY DATE(purchase_date)
       ORDER BY date`,
      [startDate, endDate]
    );
    
    // Get total purchases in the month
    const totalPurchases = await pool.query(
      `SELECT COUNT(*) as count
       FROM purchases
       WHERE purchase_date >= $1 AND purchase_date <= $2`,
      [startDate, endDate]
    );
    
    // Get category-wise purchases
    const purchasesByCategory = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM purchases
       WHERE purchase_date >= $1 AND purchase_date <= $2
       GROUP BY category
       ORDER BY count DESC`,
      [startDate, endDate]
    );
    
    // Get revenue data
    const revenue = await pool.query(
      `SELECT SUM(price) as total_revenue
       FROM purchases
       WHERE purchase_date >= $1 AND purchase_date <= $2 AND order_status != 'Canceled'`,
      [startDate, endDate]
    );
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers: parseInt(totalUsers.rows[0].count),
          totalBooks: parseInt(totalBooks.rows[0].count),
          totalPurchases: parseInt(totalPurchases.rows[0].count),
          totalRevenue: parseFloat(revenue.rows[0].total_revenue || 0)
        },
        dailyData: {
          users: userRegistrations.rows,
          books: booksUploaded.rows,
          purchases: purchases.rows
        },
        purchasesByCategory: purchasesByCategory.rows
      }
    });
    
  } catch (err) {
    console.error('Error fetching activity report:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity report',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

//////////////////////////////////// [ END ACTIVITY REPORT ] ///////////////////////////////////

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add this endpoint to your server.js
app.get('/api/stripe-config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

// Root route - Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/login.html'));
});

// Define all specific routes first
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/login.html'));
});


app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/forgot-password.html'));
});

app.get('/register', (req, res) => {
  console.log('Handling /register route');
  res.sendFile(path.join(__dirname, 'client/webpages/register.html'));
});

app.get('/user-book-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/user-book-manager.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/dashboard.html'));
});

app.get('/add-ebook', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/add-ebook.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/order.html'));
});

// Update the mybook route in server.js
app.get('/mybook', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/mybook.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/userAccount.html'));
});

app.get('/adminAccount', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/adminAccount.html'));
});

app.get('/place-order', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/place-order.html'));
});

app.get('/public-messages', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/public-messages.html'));
});

app.get('/mssgAdmin', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/mssgAdmin.html'));
});

// Add this route after the other routes
app.get('/activity-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/activity-report.html'));
});

// Start server and initialize database
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDB();
});


// The catch-all route should ALWAYS be defined LAST
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'client/webpages/login.html'));
});
