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
    
    // Create purchases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'Completed'
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
app.get('/api/books/my-purchases/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.category, p.price, p.status, p.purchase_date, 
              b.cover_image_path, u.username as seller_name
       FROM purchases p
       JOIN books b ON p.book_id = b.id
       JOIN users u ON b.seller_id = u.id
       WHERE p.buyer_id = $1
       ORDER BY p.purchase_date DESC`,
      [userId]
    );
    
    // Format the results
    const purchases = result.rows.map(purchase => ({
      id: purchase.id,
      title: purchase.title,
      category: purchase.category,
      price: parseFloat(purchase.price),
      status: purchase.status,
      purchaseDate: purchase.purchase_date,
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
    
    // Log the query for debugging
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


//////////////////////////////////// [END Add Book & Manage Order ] ///////////////////////////////////



// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route - Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/login.html'));
});

// Define all specific routes first
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

app.get('/add-ebook', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/add-ebook.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/order.html'));
});

app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/dashboard.html')); // Temporary redirect until implemented
});

app.get('/mybook', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/dashboard.html')); // Temporary redirect until implemented
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/webpages/dashboard.html')); // Temporary redirect until implemented
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
