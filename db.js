
const express = require('express');
const admin = require('firebase-admin');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')('sk_test_51QUlqlGE8h4qXEDCDyhBwWIUamRDw2aWm3IZWsZ9qsaHbf3TreTzRXj6S2F75eYo6MoZhVEJcBTysyPbeyoO35Or00fRkxnizv');
const puppeteer = require('puppeteer');

async function scrapeBooksVilla(bookName) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Navigate to the BooksVilla homepage
        await page.goto('https://booksvilla.com.pk/', { waitUntil: 'domcontentloaded' });

        // Wait for the search bar, type the book name, and click the search button
        const searchBarSelector = '.search-bar__input';
        const searchButtonSelector = '.search-bar__submit';

        await page.waitForSelector(searchBarSelector, { timeout: 120000, visible: true });
        await page.type(searchBarSelector, bookName);
        await page.waitForSelector(searchButtonSelector, { timeout: 120000, visible: true });
        await Promise.all([
            page.click(searchButtonSelector),
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }) // Wait for the new page to load
        ]);

        // Wait for the first search result on the new page
        const resultTitleSelector = '.product-item__title';
        const resultPriceSelector = '.price';

        try {
            await page.waitForSelector(resultTitleSelector, { timeout: 10000, visible: true });
        } catch {
            console.warn('No search results found.');
            return null; // No results were found
        }

        // Extract the book title and price
        const titleElement = await page.$eval(resultTitleSelector, (el) => el.textContent.trim());
        const priceRaw = await page.$eval(resultPriceSelector, (el) => el.textContent.trim());

        // If either title or price is missing, return null
        if (!titleElement || !priceRaw) {
            console.warn('No valid book data found.');
            return null;
        }

        // Extract numeric price using regex
        const priceMatch = priceRaw.match(/[\d,]+(?:\.\d+)?/);
        const price = priceMatch ? priceMatch[0].replace(/,/g, '') : null;

        // Print the details
        console.log(`Book Title: ${titleElement}`);
        console.log(`Book Price: ${price}`);

        return { title: titleElement, price };
    } catch (error) {
        console.error('Error scraping BooksVilla:', error);
        return null; // Return null on error
    } finally {
        if (browser) await browser.close();
    }
}

function generateToken(user) {
    const payload = { userId: user.user_id, email: user.email, role: user.role };
    const secretKey = process.env.JWT_SECRET || 'defaultSecretKey';
    const token = jwt.sign(payload, secretKey, { expiresIn: '1d' });
    return token;
}

// Configure storage for uploaded files
const pdfUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/'); // Directory for legal documents
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

const imageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'images/'); // Directory for cover images
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});


const app = express();
app.use(cors({
    origin: ['http://localhost:5051', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501', 'http://localhost:3000', 'http://localhost:8082'],
    credentials: true
}));
app.use(express.json()); // Middleware to parse JSON bodies
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; font-src 'self' https://fonts.gstatic.com; script-src 'self'; style-src 'self' https://fonts.googleapis.com;");
    next();
});


// Initialize Firebase Admin SDK
const serviceAccount = require('./book-store-f12c0-firebase-adminsdk-25l6o-52f2e4c53c.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// // Database connection
// const db = mysql.createConnection({
//     host: "localhost",
//     user: "root",
//     password: "Sql@05121472", // Update this to your database password
//     database: "bookstore" // Update this to your database name
// });

// Database connection
const db = mysql.createConnection({
    host: "bhhjy1yrnytbvb6rmtz0-mysql.services.clever-cloud.com",
    user: "ujw492rfy1thgucz",
    password: "AvqbTcE8KtNOWhCNKq7W", // Update this to your database password
    database: "bhhjy1yrnytbvb6rmtz0" // Update this to your database name
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        throw err;
    }
    console.log('Connected to MySQL!');
});

// Check if user exists (no sign-up functionality here)
app.post('/check-user', (req, res) => {
    console.log('Incoming request (check-user):', req.body);
    const { email } = req.body;

    if (!email) {
        console.log('Missing email in check-user');
        return res.status(400).json({ error: "Email is required" });
    }

    // Query to check if the user exists by email
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
        if (err) {
            console.error('Database query error in check-user:', err);
            return res.status(500).json({ error: "Database query error", message: err.message });
        }

        if (result.length > 0) {
            console.log('User with this email already exists');
            return res.status(409).json({ exists: true, message: "User already exists" });
        }

        console.log('User does not exist');
        return res.status(200).json({ exists: false, message: "User does not exist" });
    });
});

app.post('/signup', pdfUpload.single('legalDoc'), (req, res) => {
    console.log('Incoming request (signup):', req.body);
    const { fullname, email, role, password, storeName, addressP, contactP, addressC, contactC } = req.body;

    // Validate required fields
    if (!fullname || !email || !password) {
        console.log('Missing required fields in signup');
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (role === 'publisher' && (!storeName || !addressP || !contactP || !req.file)) {
        console.log('Missing fields for Publisher');
        return res.status(400).json({ error: "Fill required fields for Publisher" });
    }

    // Save legalDoc path for publisher
    const legalDocPath = req.file ? req.file.path : null;

    // Insert user into `users` table
    const insertUserSql = "INSERT INTO users (username, password, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)";
    const userValues = [
        fullname,
        password,
        email,
        role || 'customer',
        new Date(),
        new Date()
    ];

    db.query(insertUserSql, userValues, (err, result) => {
        if (err) {
            console.error('Database insertion error in signup:', err);
            return res.status(500).json({ error: "Failed to insert user" });
        }

        console.log('User inserted successfully in signup:', result);
        const userId = result.insertId;

        // Role-specific insertion logic
        let roleInsertSql, roleValues;
        if (role == 'admin') {
            roleInsertSql = `
            INSERT INTO admin (user_id, total_profit)
            VALUES (?, 0)`;
            roleValues = [
                userId
            ];
        }
        if (role === 'publisher') {
            roleInsertSql = `
                INSERT INTO publisher (user_id, name, company_name, phone_number, address, legal_document, approval_status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `;
            roleValues = [
                userId,
                fullname,
                storeName,
                contactP,
                addressP,
                legalDocPath // Save file path in the database
            ];
        } else if (role === 'customer') {
            roleInsertSql = `
                INSERT INTO customer (user_id, phone_number, shipping_address)
                VALUES (?, ?, ?)
            `;
            roleValues = [
                userId,
                contactC || null,
                addressC || null
            ];
        } else {
            console.error('Unsupported role:', role);
            return res.status(400).json({ error: "Unsupported role" });
        }

        db.query(roleInsertSql, roleValues, (err) => {
            if (err) {
                console.error('Role-specific insertion error in signup:', err);
                return res.status(500).json({ error: "Failed to insert role-specific data" });
            }

            res.json({ exists: false, message: "User registered successfully!" });
        });
    });
});


// Sign-In route
app.post('/signin', (req, res) => {
    console.log('Incoming request (signin):', req.body);
    const { email, password } = req.body;
    if (!email || !password) {
        console.log('Missing required fields in signin');
        return res.status(400).json({ error: "Missing required fields" });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
        if (err) {
            console.error('Database error in signin:', err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log('Query result (signin):', rows);
        if (rows.length > 0) {
            const user = rows[0];
            if (user.password === password) {
                console.log('Sign-in successful');
                const token = generateToken(user);
                const userData = {
                    message: "Sign in successful!",
                    token,
                    role: user.role // Include role in the response
                };
                res.status(200).json(userData);
            } else {
                console.log('Invalid email or password in signin');
                res.status(401).json({ error: "Invalid email or password" });
            }
        } else {
            console.log('Invalid email or password in signin');
            res.status(401).json({ error: "Invalid email or password" });
        }
    });
});

function authenticateAndFetchRoleId(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Bearer header
    console.log('Token from headers:', token);  // Log the token to verify

    if (!token) {
        return res.status(401).json({ error: 'Authentication token is missing' });
    }

    try {
        const secretKey = process.env.JWT_SECRET || 'defaultSecretKey'; // Use your JWT secret
        const decoded = jwt.verify(token, secretKey); // Verify JWT token
        console.log('Decoded token:', decoded); // Log the decoded token

        req.user = decoded; // Attach the decoded token payload to the request object
        const { userId, role } = decoded;

        const roleColumnMap = {
            admin: 'admin_id',
            publisher: 'publisher_id',
            customer: 'customer_id'
        };

        const roleIdColumn = roleColumnMap[role];
        if (!roleIdColumn) {
            return res.status(403).json({ error: `Invalid role: ${role}` });
        }

        const query = `SELECT ${roleIdColumn} AS roleId FROM ${role} WHERE user_id = ?`;

        db.query(query, [userId], (err, result) => {
            if (err) {
                console.error('Database query error for role:', role, 'User ID:', userId, 'Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (result.length === 0) {
                return res.status(404).json({ error: `No record found for role: ${role}` });
            }

            req.user.roleId = result[0].roleId; // Attach role-specific ID to the request object
            next(); // Proceed to the next middleware or route handler
        });

    } catch (err) {
        console.error('JWT verification failed:', err);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Route to fetch user role
app.get('/get-user-role', authenticateAndFetchRoleId, (req, res) => {
    // At this point, the req.user object should have the role and roleId attached
    res.json({
        role: req.user.role,
        roleId: req.user.roleId // Role-specific ID (like admin_id, publisher_id, etc.)
    });
});


// Check user existence for sign-in
app.post('/check-user-sign', (req, res) => {
    console.log('Incoming request (check-user-sign):', req.body);
    const { email } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
        if (err) {
            console.error('Database error in check-user-sign:', err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log('Query result (check-user-sign):', rows);
        res.json({ exists: rows.length > 0 });
    });
});

app.get('/check-admin', (req, res) => {
    // Query your database to check if there's already an admin
    db.query('SELECT COUNT(*) AS adminCount FROM users WHERE role = "admin"', (err, result) => {
        if (err) {
            console.error('Error checking for admin:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Check if there's at least one admin
        const adminExists = result[0].adminCount > 0;
        res.json({ adminExists });
    });
});


// Reset Password Route
app.post('/reset-password', (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required' });
    }

    // Query to find user by email
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
        if (err) {
            console.error('Database error in reset-password:', err);
            return res.status(500).json({ error: "Database error" });
        }

        // If no user is found with the provided email
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Update password and updatedAt field in the database
        db.query(
            "UPDATE users SET password = ?, updated_at = ? WHERE email = ?",
            [newPassword, new Date(), email],
            (updateErr, result) => {
                if (updateErr) {
                    console.error('Error updating password:', updateErr);
                    return res.status(500).json({ error: "Error updating password" });
                }

                // Send success response
                return res.status(200).json({ success: true, message: 'Password successfully reset' });
            }
        );
    });
});

app.get('/publisher/overview', authenticateAndFetchRoleId, (req, res) => {
    const { userId, role, roleId } = req.user;

    console.log('Authenticated User:', { userId, role, roleId });

    // Query for total number of books added by the publisher
    const booksQuery = `
        SELECT COUNT(DISTINCT b.book_id) AS total_books_added
        FROM publisher p
        LEFT JOIN publisher_books pb ON p.publisher_id = pb.publisher_id
        LEFT JOIN books b ON pb.book_id = b.book_id
        WHERE p.publisher_id = ?;  -- Use parameterized query for publisher_id
    `;

    // Query for total number of completed orders
    const ordersQuery = `
        SELECT COUNT(DISTINCT o.order_id) AS order_count
        FROM publisher p
        LEFT JOIN publisher_books pb ON p.publisher_id = pb.publisher_id
        LEFT JOIN order_details od ON pb.publisher_book_id = od.publisher_book_id
        LEFT JOIN orders o ON od.order_id = o.order_id
        WHERE p.publisher_id = ?
        AND o.status = 'delivered';  -- Only consider completed orders
    `;

    // Query for total sales from completed orders
    const salesQuery = `
        SELECT SUM(o.total_price) AS total_sales
        FROM publisher p
        LEFT JOIN publisher_books pb ON p.publisher_id = pb.publisher_id
        LEFT JOIN order_details od ON pb.publisher_book_id = od.publisher_book_id
        LEFT JOIN orders o ON od.order_id = o.order_id
        WHERE p.publisher_id = ?
        AND o.status = 'delivered';  -- Only consider completed orders
    `;

    // Execute the queries one by one
    db.query(booksQuery, [roleId], (err, booksResult) => {
        if (err) {
            console.error('Error fetching total books:', err);
            return res.status(500).json({ error: 'Database query error' });
        }

        db.query(ordersQuery, [roleId], (err, ordersResult) => {
            if (err) {
                console.error('Error fetching order count:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            db.query(salesQuery, [roleId], (err, salesResult) => {
                if (err) {
                    console.error('Error fetching total sales:', err);
                    return res.status(500).json({ error: 'Database query error' });
                }

                // Return the data in a single response
                const overviewData = {
                    total_books_added: booksResult[0] ? booksResult[0].total_books_added : 0,
                    order_count: ordersResult[0] ? ordersResult[0].order_count : 0,
                    total_sales: salesResult[0] ? salesResult[0].total_sales : 0,
                };

                res.json(overviewData);  // Return the compiled data to the client
            });
        });
    });
});

// publisher Dashboard: Manage Listings
app.get('/publisher/listings', authenticateAndFetchRoleId, (req, res) => {
    const { userId, role, roleId } = req.user;
    console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct
    const query = `
        SELECT 
        pb.publisher_book_id AS book_publisher_id, 
        b.title, 
        b.author, 
        pb.price, 
        pb.stock, 
        b.cover_image,  -- Assuming cover_image is the field name
        GROUP_CONCAT(c.name ORDER BY c.name ASC) AS category_names  -- Concatenate categories into one field
        FROM publisher_books pb
        JOIN books b ON pb.book_id = b.book_id
        JOIN book_categories bc ON b.book_id = bc.book_id
        JOIN categories c ON bc.category_id = c.category_id
        WHERE pb.publisher_id = ?
        GROUP BY pb.publisher_book_id, b.title, b.author, pb.price, pb.stock, b.cover_image`;

    db.query(query, [roleId], (err, results) => {
        if (err) return res.status(500).send(err);
        console.log('Query Result:', results);
        res.send(results);
    });
});

app.post('/publisher/add-book', authenticateAndFetchRoleId, imageUpload.single('book-cover-upload'), (req, res) => {
    const { title, author, description, publishedYear, price, stock, cover_url, categories } = req.body;
    const { userId, role, roleId } = req.user;
    console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct
    // Ensure categories is an array
    const categoryArray = Array.isArray(categories) ? categories : categories.split(',');

    // Trim each category name to remove leading/trailing spaces
    const cleanedCategories = categoryArray.map(category => category.trim());

    // Determine the cover image path: uploaded file or provided URL
    const coverImagePath = req.file ? req.file.path : cover_url;

    // Insert book into the 'books' table, including description and published year
    const insertBookQuery = `INSERT INTO books (title, author, description, published_year, cover_image) VALUES (?, ?, ?, ?, ?)`;
    db.query(insertBookQuery, [title, author, description, publishedYear, coverImagePath], (err, result) => {
        if (err) return res.status(500).send(err);

        const bookId = result.insertId;

        // Insert book into the 'publisher_books' table to associate it with the publisher
        const insertBookPublisherQuery = `INSERT INTO publisher_books (book_id, publisher_id, price, stock) VALUES (?, ?, ?, ?)`;
        db.query(insertBookPublisherQuery, [bookId, roleId, price, stock], (err) => {
            if (err) return res.status(500).send(err);

            // Loop through categories array to insert each category
            cleanedCategories.forEach((categoryName) => {
                // First, check if the category already exists
                const checkCategoryQuery = `SELECT category_id FROM categories WHERE name = ?`;
                db.query(checkCategoryQuery, [categoryName], (err, result) => {
                    if (err) return res.status(500).send(err);

                    let categoryId;

                    if (result.length > 0) {
                        // Category exists, use existing category_id
                        categoryId = result[0].category_id;
                    } else {
                        // Category doesn't exist, insert a new one
                        const insertCategoryQuery = `INSERT INTO categories (name) VALUES (?)`;
                        db.query(insertCategoryQuery, [categoryName], (err, result) => {
                            if (err) return res.status(500).send(err);

                            categoryId = result.insertId;

                            // Insert into the 'book_categories' table
                            const insertBookCategoryQuery = `INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)`;
                            db.query(insertBookCategoryQuery, [bookId, categoryId], (err) => {
                                if (err) return res.status(500).send(err);
                            });
                        });
                    }

                    // If the category exists, insert into 'book_categories'
                    if (categoryId) {
                        const insertBookCategoryQuery = `INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)`;
                        db.query(insertBookCategoryQuery, [bookId, categoryId], (err) => {
                            if (err) return res.status(500).send(err);
                        });
                    }
                });
            });

            // Respond with success
            res.send({ success: true, message: 'Book and categories added successfully' });
        });
    });
});

// Delete Book
app.delete('/books/:bookId', authenticateAndFetchRoleId, (req, res) => {
    const { bookId } = req.params;
    const { roleId } = req.user.roleId; // Make sure only the publisher who owns the book can delete it

    // First, check if the book exists and belongs to the publisher
    const checkBookQuery = `SELECT * FROM publisher_books WHERE book_id = ? AND publisher_id = ?`;
    db.query(checkBookQuery, [bookId, roleId], (err, result) => {
        if (err) return res.status(500).send(err);

        if (result.length === 0) {
            // Book not found or does not belong to the publisher
            return res.status(404).send({ message: "Book not found or unauthorized action" });
        }

        // Delete the book from 'book_categories' (if exists)
        const deleteCategoriesQuery = `DELETE FROM book_categories WHERE book_id = ?`;
        db.query(deleteCategoriesQuery, [bookId], (err) => {
            if (err) return res.status(500).send(err);

            // Delete the book from 'publisher_books'
            const deletePublisherBookQuery = `DELETE FROM publisher_books WHERE book_id = ? AND publisher_id = ?`;
            db.query(deletePublisherBookQuery, [bookId, roleId], (err) => {
                if (err) return res.status(500).send(err);

                // Finally, delete the book from 'books' table
                const deleteBookQuery = `DELETE FROM books WHERE book_id = ?`;
                db.query(deleteBookQuery, [bookId], (err) => {
                    if (err) return res.status(500).send(err);

                    // Send success response
                    res.send({ success: true, message: "Book deleted successfully" });
                });
            });
        });
    });
});

// API endpoint to fetch categories
app.get('/fetch_categories', (req, res) => {
    const query = 'SELECT name FROM categories';
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(results); // Send categories as JSON
    });
});

app.get('/fetch_authors', (req, res) => {
    const query = "SELECT DISTINCT author FROM books";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching authors: " + err.stack);
            res.status(500).send("Server Error");
        } else {
            res.json(results);
        }
    });
});

// Define the route to fetch featured books
app.get('/api/featured-books', (req, res) => {
    const query = `
      SELECT 
          b.book_id, 
          b.title, 
          b.author, 
          b.cover_image, 
          b.description, 
          b.published_year, 
          AVG(br.rating) AS average_rating, 
          MAX(d.discount_code) AS discount_code, 
          MAX(d.discount_value) AS discount_value, 
          MAX(d.valid_until) AS valid_until
      FROM books b
      LEFT JOIN publisher_books pb ON b.book_id = pb.book_id
      LEFT JOIN book_ratings br ON b.book_id = br.book_id
      LEFT JOIN publisher_book_discounts pbd ON pb.publisher_book_id = pbd.publisher_book_id
      LEFT JOIN discounts d ON pbd.discount_id = d.discount_id
      WHERE br.rating IN (4, 5) -- Fetch books with ratings of 4 or 5
      GROUP BY 
          b.book_id, 
          b.title, 
          b.author, 
          b.cover_image, 
          b.description, 
          b.published_year
      ORDER BY average_rating DESC
      LIMIT 8; -- Top 8 highest-rated books
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching books: ', err);
            res.status(500).send('Error fetching books');
            return;
        }
        res.json(results); // Send the results as JSON
    });
});

// Route to fetch and display books
app.get('/api/books', (req, res) => {
    const query = `
        SELECT b.book_id, b.title, b.author, b.cover_image, b.description, b.published_year, pb.price, pb.stock 
        FROM books b 
        JOIN publisher_books pb ON b.book_id = pb.book_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching books:', err.stack);
            res.status(500).send('Error fetching books');
        } else {
            console.log('Fetched books:', results); // Debug log
            res.json(results);
        }
    });
});

// API endpoint to compare prices
app.get('/compare_price/:book', (req, res) => {
    const bookName = req.params.book;

    const localQuery = `
        SELECT b.title, 
       pb.price,
       d.discount_value,
       pb.price - (pb.price * (d.discount_value / 100)) AS discounted_price
FROM books b
JOIN publisher_books pb ON b.book_id = pb.book_id
LEFT JOIN publisher_book_discounts pbd ON pb.publisher_book_id = pbd.publisher_book_id
LEFT JOIN discounts d ON pbd.discount_id = d.discount_id
WHERE b.title = ? 
`;

    db.query(localQuery, [bookName], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to execute database query' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Book not found in local database' });
        }

        const localBook = results[0];

        try {
            const booksvillaPrice = await scrapeBooksVilla(bookName);

            const comparison = {
                local: localBook,
                booksvilla: booksvillaPrice
            };

            res.json(comparison);
        } catch (scrapeError) {
            console.error(scrapeError);
            res.status(500).json({ error: 'Failed to scrape BooksVilla' });
        }
    });
});

// Get Book Details for Editing
app.get('/publisher/listings/:bookId', authenticateAndFetchRoleId, (req, res) => {
    console.log("api called");
    const { bookId } = req.params;
    const { roleId } = req.user;
    console.log("bookid", bookId);
    console.log("roleid", roleId);

    const query = `
        SELECT 
        pb.publisher_book_id AS book_publisher_id, 
        b.title, 
        b.author, 
        pb.price, 
        pb.stock, 
        b.cover_image,  -- Assuming cover_image is the field name
        GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS category_names,  -- Concatenate categories
        b.description,  -- Assuming description is a column in the books table
        b.published_year  -- Assuming published_year is a column in the books table
    FROM publisher_books pb
    JOIN books b ON pb.book_id = b.book_id
    JOIN book_categories bc ON b.book_id = bc.book_id
    JOIN categories c ON bc.category_id = c.category_id
    WHERE pb.publisher_id = ? AND pb.book_id = ?
    GROUP BY pb.publisher_book_id, b.title, b.author, pb.price, pb.stock, b.cover_image, b.description, b.published_year`;

    db.query(query, [roleId, bookId], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length === 0) {
            return res.status(404).send({ message: "Book not found" });
        }
        console.log("Fetched Book Data:", result[0]);
        res.send(result[0]); // Send the first (and only) result
    });
});

app.get("/api/book/:bookId", (req, res) => {
    const { bookId } = req.params;

    const query = `
            SELECT 
    b.book_id, 
    b.title, 
    b.author, 
    b.cover_image, 
    b.description, 
    b.published_year, 
    pb.price AS original_price, 
    pb.stock, 
    pb.publisher_id, 
    p.name AS publisher_name,
    IFNULL(AVG(br.rating), 0) AS average_rating,
    COUNT(br.rating) AS total_ratings,
    IFNULL(d.discount_value, 0) AS discount_value,
    d.description AS discount_description,
    d.valid_from,
    d.valid_until,
    -- Calculate discounted price
    IFNULL(pb.price - (pb.price*(d.discount_value/100)), pb.price) AS discounted_price
FROM books b
LEFT JOIN publisher_books pb ON b.book_id = pb.book_id
LEFT JOIN publisher p ON pb.publisher_id = p.publisher_id
LEFT JOIN book_ratings br ON b.book_id = br.book_id
LEFT JOIN publisher_book_discounts pbd ON pb.publisher_book_id = pbd.publisher_book_id
LEFT JOIN discounts d ON pbd.discount_id = d.discount_id
WHERE b.book_id = ?
GROUP BY b.book_id, pb.price, pb.stock, pb.publisher_id, p.name, d.discount_value, d.description, d.valid_from, d.valid_until;
    `;

    const reviewsQuery = `
        SELECT 
            br.rating, 
            br.review, 
            br.created_at, 
            u.username as customer_name
        FROM book_ratings br
        JOIN customer c ON br.customer_id = c.customer_id
        JOIN users u ON c.user_id = u.user_id
        WHERE br.book_id = ?;
    `;

    // Execute the queries
    db.query(query, [bookId], (err, bookResult) => {
        if (err) {
            console.error("Error fetching book details:", err);
            return res.status(500).send({ error: "Database error" });
        }
        if (bookResult.length === 0) {
            return res.status(404).send({ error: "Book not found" });
        }

        db.query(reviewsQuery, [bookId], (err, reviewsResult) => {
            if (err) {
                console.error("Error fetching book reviews:", err);
                return res.status(500).send({ error: "Database error" });
            }

            // Combine book details with reviews
            const bookDetails = {
                ...bookResult[0],
                reviews: reviewsResult,
            };

            res.status(200).send(bookDetails);
        });
    });
});

// POST /api/cart - Adds a book to the cart with the specified quantity
app.post("/api/cart", authenticateAndFetchRoleId, (req, res) => {
    const { bookId, quantity } = req.body;
    const customerId = req.user.roleId;

    if (!customerId || !bookId || !quantity) {
        return res.status(400).send({ error: "Missing required fields" });
    }

    const getPublisherBookQuery = "SELECT publisher_book_id FROM publisher_books WHERE book_id = ?";
    const getCartQuery = "SELECT cart_id FROM cart WHERE customer_id = ?";
    const insertCartQuery = "INSERT INTO cart (customer_id) VALUES (?)";
    const addItemQuery = `
        INSERT INTO cart_items (cart_id, publisher_book_id, quantity)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);
    `;

    // Fetch publisherBookId using bookId
    db.query(getPublisherBookQuery, [bookId], (err, publisherResult) => {
        if (err) {
            console.error("Error fetching publisherBookId:", err);
            return res.status(500).send({ error: "Database error" });
        }

        if (publisherResult.length === 0) {
            return res.status(404).send({ error: "Book not found" });
        }

        const publisherBookId = publisherResult[0].publisher_book_id;

        // Check if the customer already has a cart
        db.query(getCartQuery, [customerId], (err, cartResult) => {
            if (err) {
                console.error("Error checking cart:", err);
                return res.status(500).send({ error: "Database error" });
            }

            if (cartResult.length > 0) {
                // Cart exists
                const cartId = cartResult[0].cart_id;
                db.query(addItemQuery, [cartId, publisherBookId, quantity], (err) => {
                    if (err) {
                        console.error("Error adding item to cart:", err);
                        return res.status(500).send({ error: "Database error" });
                    }
                    res.status(200).send({ message: "Item added to cart successfully" });
                });
            } else {
                // Create a new cart
                db.query(insertCartQuery, [customerId], (err, insertResult) => {
                    if (err) {
                        console.error("Error creating cart:", err);
                        return res.status(500).send({ error: "Database error" });
                    }

                    const newCartId = insertResult.insertId;
                    db.query(addItemQuery, [newCartId, publisherBookId, quantity], (err) => {
                        if (err) {
                            console.error("Error adding item to new cart:", err);
                            return res.status(500).send({ error: "Database error" });
                        }
                        res.status(200).send({ message: "Item added to cart successfully" });
                    });
                });
            }
        });
    });
});

app.post('/api/book/:bookId/review', authenticateAndFetchRoleId, (req, res) => {
    const { rating, review } = req.body;
    const { bookId } = req.params;
    const customerId = req.user.roleId; // Assuming the customer ID is sent in the body

    const query = `
        INSERT INTO book_ratings (book_id, customer_id, rating, review)
        VALUES (?, ?, ?, ?)
    `;

    db.query(query, [bookId, customerId, rating, review], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Failed to submit review' });
        }

        res.status(201).json({ message: 'Review submitted successfully' });
    });
});

// API Endpoint to Get Orders by Customer ID
app.get("/api/orders", authenticateAndFetchRoleId, (req, res) => {
    const customerId  = req.user.roleId;
  
    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }
  
    const query = `
      SELECT 
        o.order_id,
        o.total_price,
        o.status AS order_status,
        o.delivery_date,
        s.shipping_status,
        s.estimated_delivery_date
      FROM orders o
      LEFT JOIN shipping s ON o.order_id = s.order_id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC;
    `;
  
    db.query(query, [customerId], (err, results) => {
      if (err) {
        console.error("Error fetching orders:", err.message);
        return res.status(500).json({ error: "Failed to fetch orders." });
      }
  
      res.status(200).json({ orders: results });
    });
  });

  app.get("/api/books/:author", (req, res) => {
    const { author} = req.params;

    const query = `
        SELECT 
            book_id, 
            title,
            description, 
            cover_image 
        FROM books 
        WHERE author = ?;
    `;

    db.query(query, [author], (err, results) => {
        if (err) {
            console.error("Error fetching books by author:", err.message);
            return res.status(500).json({ error: "Failed to fetch books." });
        }

        res.status(200).json({ books: results });
    });
});

app.get("/api/books/category/:category", (req, res) => {
    const { category } = req.params;

    const query = `
        SELECT 
            b.book_id, 
            b.title, 
            b.description, 
            b.cover_image 
        FROM books AS b
        JOIN book_categories AS bc ON b.book_id = bc.book_id
        JOIN categories AS c ON bc.category_id = c.category_id
        WHERE c.name = ?;
    `;

    db.query(query, [category], (err, results) => {
        if (err) {
            console.error("Error fetching books by category:", err.message);
            return res.status(500).json({ error: "Failed to fetch books." });
        }

        res.status(200).json({ books: results });
    });
});

app.put(
    "/publisher/update/:bookId",
    authenticateAndFetchRoleId,
    imageUpload.single("edit-book-cover-upload"),
    (req, res) => {
        const bookId = req.params.bookId;
        const { title, author, description, publishedYear, categories, price, stock, cover_url } = req.body;
        const { userId, role, roleId } = req.user; // Assuming publisher_id is in the JWT.

        let coverImage = cover_url || null;
        if (req.file) {
            coverImage = req.file.path; // Use the uploaded file path if provided.
        }

        // Check fields to update dynamically
        const fieldsToUpdate = {};
        if (title) fieldsToUpdate.title = title;
        if (author) fieldsToUpdate.author = author;
        if (description) fieldsToUpdate.description = description;
        if (publishedYear) fieldsToUpdate.published_year = publishedYear;
        if (coverImage) fieldsToUpdate.cover_image = coverImage;

        // Start constructing the SQL query for updating the book
        let updateFieldsQuery = "";
        let updateFieldsValues = [];

        if (Object.keys(fieldsToUpdate).length > 0) {
            updateFieldsQuery = Object.keys(fieldsToUpdate)
                .map((key) => `${key} = ?`)
                .join(", ");
            updateFieldsValues = Object.values(fieldsToUpdate);
            updateFieldsValues.push(bookId); // Add bookId to the values
        }

        if (updateFieldsQuery) {
            const updateBookQuery = `
          UPDATE books
          SET ${updateFieldsQuery}
          WHERE book_id = ?;
        `;

            db.query(updateBookQuery, updateFieldsValues, (err) => {
                if (err) {
                    return res.status(500).send("Error updating book details: " + err.message);
                }
            });
        }

        // Handle categories
        if (categories) {
            const categoryIds = categories.split(",").map((c) => c.trim());

            // First, check for existing categories in the 'categories' table
            const checkCategoryQuery = `SELECT category_id FROM categories WHERE category_id IN (?)`;
            db.query(checkCategoryQuery, [categoryIds], (err, existingCategories) => {
                if (err) {
                    return res.status(500).send("Error checking categories: " + err.message);
                }

                // Get the IDs of categories that already exist
                const existingCategoryIds = existingCategories.map((row) => row.category_id);

                // Filter out the categories that already exist
                const newCategoryIds = categoryIds.filter((id) => !existingCategoryIds.includes(id));

                if (newCategoryIds.length > 0) {
                    // Insert new categories that don't exist yet
                    const insertCategoriesQuery = `
              INSERT INTO categories (category_id) VALUES ?;
            `;
                    const newCategoryValues = newCategoryIds.map((id) => [id]);
                    db.query(insertCategoriesQuery, [newCategoryValues], (err) => {
                        if (err) {
                            return res.status(500).send("Error inserting new categories: " + err.message);
                        }
                    });
                }

                // Insert the categories associated with this book (new and existing categories)
                const insertBookCategoriesQuery = `
            INSERT INTO book_categories (book_id, category_id)
            SELECT ?, category_id
            FROM categories
            WHERE category_id IN (?);
          `;
                db.query(insertBookCategoriesQuery, [bookId, categoryIds], (err) => {
                    if (err) {
                        return res.status(500).send("Error inserting book categories: " + err.message);
                    }
                });
            });
        }

        // Update publisher-specific book details (price and stock)
        const updatePublisherBookQuery = `
        UPDATE publisher_books
        SET price = ?, stock = ?
        WHERE book_id = ? AND publisher_id = ?;
      `;
        db.query(updatePublisherBookQuery, [price, stock, bookId, roleId], (err) => {
            if (err) {
                return res.status(500).send("Error updating publisher book details: " + err.message);
            }

            res.status(200).send({ message: "Book updated successfully" });
        });
    }
);


// Orders
app.get('/publisher/orders', authenticateAndFetchRoleId, (req, res) => {
    const { userId, role, roleId } = req.user;
    console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct

    const query = `
      SELECT o.order_id, o.total_price AS total_amount, o.status AS order_status, 
            u.username AS customer_name, 
            b.title AS book_title, oi.quantity, oi.price
        FROM orders o
        JOIN order_details oi ON o.order_id = oi.order_id
        JOIN publisher_books pb ON oi.publisher_book_id = pb.publisher_book_id
        JOIN publisher p ON pb.publisher_id = p.publisher_id
        JOIN customer c ON o.customer_id = c.customer_id
        JOIN users u ON c.user_id = u.user_id
        JOIN books b ON pb.book_id = b.book_id
        WHERE p.publisher_id = ?
       `;

    db.query(query, [roleId], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(404).send('No orders found for this publisher');
        }

        // Debugging: log the results
        console.log(results); // Log the results to see what is returned

        res.json(results);
    });
});

// Get Feedback for publisher
app.get('/publisher/feedback', authenticateAndFetchRoleId, (req, res) => {
    const { userId, role, roleId } = req.user;
    console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct
    const query = `
       SELECT 
            r.rating, 
            r.review AS comment, 
            r.created_at AS feedback_date,
            b.title AS book_title,
            c.customer_id,
            cu.username AS customer_username
        FROM publisher s
        JOIN publisher_books pb ON s.publisher_id = pb.publisher_id
        JOIN books b ON pb.book_id = b.book_id
        JOIN book_ratings r ON r.book_id = b.book_id
        LEFT JOIN customer c ON r.customer_id = c.customer_id
        LEFT JOIN users cu ON c.user_id = cu.user_id
        WHERE s.publisher_id = ?
        ORDER BY r.created_at DESC
        LIMIT 0, 1000`;

    db.query(query, [roleId], (err, results) => {
        if (err) {
            return res.status(500).send({ error: 'Database query failed', details: err });
        }

        if (results.length === 0) {
            return res.status(404).send({ message: 'No feedback found for this publisher' });
        }

        // Construct feedback response
        const feedback = results.map(item => ({
            rating: item.rating,
            comment: item.comment,
            feedback_date: item.feedback_date,
            book_title: item.book_title,
            customer: {
                customer_id: item.customer_id,
                username: item.customer_username,
            },
        }));
        console.log(feedback);
        res.send({ roleId: roleId, feedback });
    });
});

app.get('/analytics/sales', authenticateAndFetchRoleId, (req, res) => {
    const { userId, role, roleId } = req.user;
    console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct

    // If publisherId is not provided or invalid
    if (!roleId) {
        return res.status(400).json({ error: 'Publisher ID is required.' });
    }

    // Query for sales data over time (e.g., monthly sales) for the specific publisher
    const query1 = `
        SELECT SUM(o.total_price) AS total_sales
        FROM publisher p
        LEFT JOIN publisher_books pb ON p.publisher_id = pb.publisher_id
        LEFT JOIN order_details od ON pb.publisher_book_id = od.publisher_book_id
        LEFT JOIN orders o ON od.order_id = o.order_id
        WHERE p.publisher_id = ?
        AND o.status = 'delivered'
    `;

    // Query for sales per book (top-selling books) for the specific publisher
    const query2 = `
        SELECT 
            b.title AS book_title,
            SUM(od.quantity) AS total_quantity_sold
        FROM order_details od
        JOIN publisher_books pb ON od.publisher_book_id = pb.publisher_book_id
        JOIN books b ON pb.book_id = b.book_id
        WHERE pb.publisher_id = ? 
        GROUP BY b.title
        ORDER BY total_quantity_sold DESC
        LIMIT 5;
    `;

    // Execute the first query to get monthly sales data for the publisher
    db.query(query1, [roleId], (err, monthlySalesData) => {
        if (err) return res.status(500).send(err);

        // Execute the second query to get top-selling books for the publisher
        db.query(query2, [roleId], (err, topSellingBooksData) => {
            if (err) return res.status(500).send(err);

            // Send both datasets to the frontend as JSON
            res.json({
                monthlySales: monthlySalesData,
                topBooks: topSellingBooksData
            });
        });
    });
});

// Route to get the books of the logged-in publisher
app.get('/publisher-books', authenticateAndFetchRoleId,(req, res) => {
    const publisherId = req.user.roleId; // Assume publisher_id is stored in session after login
    const query = `
      SELECT pb.publisher_book_id, b.title
      FROM publisher_books pb
      JOIN books b ON pb.book_id = b.book_id
      WHERE pb.publisher_id = ?;
    `;
  
    db.query(query, [publisherId], (err, results) => {
      if (err) {
        return res.status(500).send('Database error');
      }
  
      // Return the list of books as JSON
      res.json(results);
    });
  });
  
  app.post('/apply-discount', (req, res) => {
    const { discountCode, discountDescription, discountValue, discountExpiry, publisherBookId } = req.body;
  
    console.log('Received request body:', req.body); // Add this to see the incoming data
  
    const discountQuery = `
      INSERT INTO discounts (discount_code, description, discount_value, valid_from, valid_until)
      VALUES (?, ?, ?, NOW(), ?);
    `;
  
    db.query(discountQuery, [discountCode, discountDescription, discountValue, discountExpiry], (err, result) => {
      if (err) {
        console.error('Error applying discount:', err); // Log any errors from the query
        return res.status(500).json({ success: false, message: 'Error applying discount' });
      }
  
      const discountId = result.insertId;
      const applyDiscountQuery = `
        INSERT INTO publisher_book_discounts (publisher_book_id, discount_id)
        VALUES (?, ?);
      `;
  
      db.query(applyDiscountQuery, [publisherBookId, discountId], (err) => {
        if (err) {
          console.error('Error linking discount to book:', err); // Log any errors from the second query
          return res.status(500).json({ success: false, message: 'Error linking discount to book' });
        }
  
        console.log('Discount applied successfully');
        res.status(200).json({ success: true, message: 'Discount applied successfully' });
      });
    });
  });
  
// // Profile Settings
// app.get('/profile', authenticateAndFetchRoleId, (req, res) => {
//     const { roleId } = req.user;  // Assuming `roleId` is part of the decoded JWT token

//     console.log('Publisher ID:', roleId); // Log publisherId to verify it's correct

//     // Query the database to get user data based on the roleId (publisher_id)
//     const query = 'SELECT company_name, name, phone_number, address FROM publisher WHERE publisher_id = ?';

//     db.query(query, [roleId], (err, results) => {
//       if (err) {
//         console.error('Database Error:', err);
//         return res.status(500).json({ message: 'Error fetching data' });
//       }

//       // Send back the user data as JSON
//       if (results.length > 0) {
//         res.json(results[0]);
//       } else {
//         res.status(404).json({ message: 'User not found' });
//       }
//     });
//   });

//   app.post('/updateProfile', authenticateAndFetchRoleId, imageUpload.single('legal-document'), (req, res) => {
//     const { roleId } = req.user;
//     console.log("Received data:", req.body);  // Log the incoming data
//     console.log("File:", req.file);  // Log the uploaded file details
//     if (!roleId) {
//         return res.status(401).json({ message: 'Unauthorized access' });
//     }

//     const { company_name, name, phone_number, address, old_password, new_password } = req.body;
//     let legaldoc = null;

//     if (req.file) {
//         console.log("Uploaded File:", req.file); // Log file details
//         legaldoc = req.file.path; 
//     }

//     // Fetch current user data for comparison
//     const fetchUserQuery = `SELECT company_name, name, phone_number, address, password, cover_url FROM publisher WHERE publisher_id = ?`;
//     db.query(fetchUserQuery, [roleId], (err, results) => {
//         if (err) {
//             console.error("Error fetching user data:", err);
//             return res.status(500).json({ message: 'Error fetching user data', error: err });
//         }

//         const currentData = results[0];
//         const updatedFields = [];
//         const values = [];

//         // Validate old password if provided
//         if (old_password && currentData.password !== old_password) {
//             return res.status(400).json({ message: 'Old password does not match' });
//         }

//         // Only add fields that have changed
//         if (company_name && company_name !== currentData.company_name) {
//             updatedFields.push('company_name = ?');
//             values.push(company_name);
//         }

//         if (name && name !== currentData.name) {
//             updatedFields.push('name = ?');
//             values.push(name);
//         }

//         if (phone_number && phone_number !== currentData.phone_number) {
//             updatedFields.push('phone_number = ?');
//             values.push(phone_number);
//         }

//         if (address && address !== currentData.address) {
//             updatedFields.push('address = ?');
//             values.push(address);
//         }

//         if (new_password && new_password !== currentData.password) {
//             values.push(new_password);
//         }

//         if (legaldoc && legaldoc !== currentData.cover_url) {
//             updatedFields.push('cover_url = ?');
//             values.push(legaldoc);
//         }

//         if (updatedFields.length === 0) {
//             return res.status(400).json({ message: 'No fields to update' });
//         }

//         // Build the update query
//         let updateQuery = `UPDATE publisher SET ${updatedFields.join(', ')} WHERE publisher_id = ?`;
//         values.push(roleId);  // Add publisher_id to values

//         // Log the query for debugging
//         console.log("Update Query:", updateQuery);
//         console.log("Values:", values);

//         db.query(updateQuery, values, (err, results) => {
//             if (err) {
//                 console.error("Error updating profile:", err);
//                 return res.status(500).json({ message: 'Error updating profile', error: err });
//             }

//             if (results.affectedRows > 0) {
//                 res.status(200).json({ message: 'Profile updated successfully' });
//             } else {
//                 res.status(404).json({ message: 'User not found or no changes detected' });
//             }
//         });
//     });
// });

app.post('/get-cart', authenticateAndFetchRoleId, (req, res) => {
    console.log("API called");
    const roleId = req.user.roleId;
    console.log("Role ID:", roleId);

    // Updated query to fetch the cover image and publisher name
    db.query(
        `SELECT 
            ci.cart_item_id, 
            ci.publisher_book_id,
            b.title, 
            b.author, 
            pb.price, 
            ci.quantity, 
            b.cover_image,
            p.name AS publisher_name
        FROM 
            cart_items ci 
        JOIN 
            publisher_books pb ON ci.publisher_book_id = pb.publisher_book_id 
        JOIN 
            books b ON pb.book_id = b.book_id 
        JOIN 
            publisher p ON pb.publisher_id = p.publisher_id
        JOIN 
            cart c ON ci.cart_id = c.cart_id 
        WHERE 
            c.customer_id = ?`,
        [roleId],
        (err, cartItems) => {
            if (err) {
                console.error("Error fetching cart items:", err);
                return res.status(500).send({ message: 'Error fetching cart items' });
            }
            console.log('Cart items:', cartItems);
            res.json({ cartItems });
        }
    );
});


// API to remove an item from the cart
app.delete('/remove-item', authenticateAndFetchRoleId, (req, res) => {
    const { itemId } = req.body;
    const roleId = req.user.roleId;

    // // Get customer_id from the users table
    // db.query('SELECT customer_id FROM customer WHERE user_id = ?', [userId], (err, result) => {
    //     if (err) return res.status(500).send({ message: 'Database error' });

    //     const customerId = result[0]?.customer_id;
    //     if (!customerId) return res.status(404).send({ message: 'Customer not found' });

    // Check if the item belongs to the user's cart
    db.query(
        'DELETE ci FROM cart_items ci ' +
        'JOIN cart c ON ci.cart_id = c.cart_id ' +
        'WHERE ci.cart_item_id = ? AND c.customer_id = ?',
        [itemId, roleId],
        (err, result) => {
            if (err) return res.status(500).send({ message: 'Error removing item' });

            if (result.affectedRows > 0) {
                res.json({ success: true, message: 'Item removed from cart' });
            } else {
                res.status(400).send({ message: 'Item not found in your cart' });
            }
        }
    );
});

app.post('/cart/update', (req, res) => {
    console.log('Received data:', req.body);
    const { cart_item_id, quantity } = req.body;

    if (!cart_item_id || !quantity) {
        return res.status(400).send({ success: false, message: 'Invalid request data' });
    }

    const updateQuery = `
            UPDATE cart_items
            SET quantity = ?
            WHERE cart_item_id = ?;
        `;

    db.query(updateQuery, [quantity, cart_item_id], (err) => {
        if (err) {
            return res.status(500).send({ success: false, message: 'Database error: ' + err.message });
        }

        res.send({ success: true, message: 'Cart item updated successfully' });
    });
});

// Route to place an order
app.post('/place-order', authenticateAndFetchRoleId, (req, res) => {
    const { mobile, name, address, paymentMethod, cartItems, totalAmount, stripeToken, meetingDetails } = req.body;
    const customerId = req.user.roleId; // Use the roleId from req.user set by the middleware
    console.log("customer id", customerId);
    console.log("cart", cartItems);
    console.log("total", totalAmount);

    // Step 1: Insert the order into the `orders` table
    db.query('INSERT INTO orders (customer_id, total_price, status) VALUES (?, ?, ?)', [customerId, totalAmount, 'pending'], (err, orderResult) => {
        if (err) {
            console.error('Error inserting into orders:', err);
            return res.status(500).json({ error: 'Error placing order' });
        }

        const orderId = orderResult.insertId;
        console.log("orderid", orderId);
        const today = new Date();
        today.setDate(today.getDate() + 8); // Add 8 days to today's date
        const estimatedDeliveryDate = today.toISOString().split('T')[0]; // Convert to 'YYYY-MM-DD'

        // Step 2: Insert shipping details
        db.query('INSERT INTO shipping (order_id, shipping_status, shipping_cost, estimated_delivery_date) VALUES (?, ?, ?, ?)', [orderId, 'pending', 0, estimatedDeliveryDate], (err) => {
            if (err) {
                console.error('Error inserting into shipping:', err);
                return res.status(500).json({ error: 'Error adding shipping details' });
            }
        });

        // Step 3: Insert items into `order_details`, update stock, and handle profits sequentially
        const processCartItems = (index) => {
            if (index >= cartItems.length) {
                clearCartItems();
                // All items processed, proceed to Stripe session creation
                createStripeSession(orderId);
                return;
            }

            const { publisher_book_id, quantity, price } = cartItems[index];

            // Fetch publisher_id and approved_by (admin_id) for profit calculation
            db.query(
                `SELECT pb.publisher_id, p.approved_by
                 FROM publisher_books pb
                 JOIN publisher p ON pb.publisher_id = p.publisher_id
                 WHERE pb.publisher_book_id = ?`,
                [publisher_book_id],
                (err, publisherData) => {
                    if (err || publisherData.length === 0) {
                        console.error('Error fetching publisher or admin data:', err || 'No data found');
                        return res.status(500).json({ error: 'Error processing order details' });
                    }

                    const { publisher_id, approved_by: admin_id } = publisherData[0];

                    // Insert item into `order_details`
                    db.query('INSERT INTO order_details (order_id, publisher_book_id, quantity, price) VALUES (?, ?, ?, ?)',
                        [orderId, publisher_book_id, quantity, price], (err) => {
                            if (err) {
                                console.error('Error inserting into order_details:', err);
                                return res.status(500).json({ error: 'Error adding order details' });
                            }

                            // Update stock for the item
                            db.query('UPDATE publisher_books SET stock = stock - ? WHERE publisher_book_id = ?',
                                [quantity, publisher_book_id], (err) => {
                                    if (err) {
                                        console.error('Error updating stock:', err);
                                        return res.status(500).json({ error: 'Error updating stock' });
                                    }

                                    // Calculate and insert publisher profit
                                    const profitAmount = (price * quantity * 0.05).toFixed(2);
                                    db.query(
                                        `INSERT INTO publisher_profits (publisher_id, order_id, admin_id, profit_amount, total_order_amount)
                                         VALUES (?, ?, ?, ?, ?)`,
                                        [publisher_id, orderId, admin_id, profitAmount, totalAmount], (err) => {
                                            if (err) {
                                                console.error('Error inserting into publisher_profits:', err);
                                                return res.status(500).json({ error: 'Error processing publisher profit' });
                                            }

                                            // Update admin total profit
                                            db.query(
                                                `UPDATE admin SET total_profit = total_profit + ? WHERE admin_id = ?`,
                                                [profitAmount, admin_id], (err) => {
                                                    if (err) {
                                                        console.error('Error updating admin total profit:', err);
                                                        return res.status(500).json({ error: 'Error updating admin profit' });
                                                    }

                                                    // Process the next item
                                                    processCartItems(index + 1);
                                                });
                                        });
                                });
                        });
                });
        };

        // Start processing cart items
        processCartItems(0);

         // Function to clear the cart for the current customer
         const clearCartItems = () => {
            db.query('DELETE FROM cart WHERE customer_id = ?', [customerId], (err) => {
                if (err) {
                    console.error('Error clearing cart:', err);
                    return res.status(500).json({ error: 'Error clearing cart items' });
                }
                console.log('Cart items cleared successfully.');
            });
        };

        // Step 4: Create Stripe Checkout session
        const createStripeSession = (orderId) => {
            console.log("stripe seesion started");
            stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd', // Adjust currency as needed
                            product_data: {
                                name: 'Order Payment', // Adjust product name
                            },
                            unit_amount: totalAmount * 100, // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `http://localhost:5500/orderConfirmation.html`,
                cancel_url: 'http://localhost:5500/cancel.html',
                metadata: { ...meetingDetails, orderId },
            }, (stripeError, session) => {
                if (stripeError) {
                    console.error('Stripe error:', stripeError);
                    return res.status(500).json({ error: 'Error creating Stripe session' });
                }
                console.log("Stripe session created:", session);

                // Step 5: Insert payment record
                db.query('INSERT INTO payment (order_id, payment_method, amount, payment_status) VALUES (?, ?, ?, ?)',
                    [orderId, paymentMethod, totalAmount, 'pending'], (err) => {
                        if (err) {
                            console.error('Error inserting into payment:', err);
                            return res.status(500).json({ error: 'Error processing payment' });
                        }

                        // Step 6: Respond with Stripe checkout URL
                        res.json({ url: session.url });
                    });
            });
        };
    });
});


// // Stripe Webhook for handling successful payments
// app.post('/webhook', async (req, res) => {
//     const sig = req.headers['stripe-signature'];
//     const endpointSecret = 'your_webhook_secret_key';  // Replace with your Stripe webhook secret key
//     const payload = req.body;

//     let event;

//     try {
//         event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
//     } catch (err) {
//         console.error('Error verifying webhook signature:', err);
//         return res.status(400).send('Webhook error');
//     }

//     if (event.type === 'checkout.session.completed') {
//         const session = event.data.object;
//         const orderId = session.metadata.orderId;

//         // // Update the order status to 'paid'
//         // db.query('UPDATE orders SET status = ? WHERE order_id = ?', ['paid', orderId], (err, result) => {
//         //     if (err) {
//         //         console.error('Error updating order status:', err);
//         //     }
//         // });

//         // You can also mark payment as completed in the `payment` table
//         db.query('UPDATE payment SET payment_status = ? WHERE order_id = ?', ['completed', orderId], (err, result) => {
//             if (err) {
//                 console.error('Error updating payment status:', err);
//             }
//         });
//     }

//     res.status(200).json({ received: true });
// });

// API endpoint to fetch user details
app.get('/checkout/get-user-details/', authenticateAndFetchRoleId, (req, res) => {
    const userId = req.user.userId;
    console.log("user id", userId)

    // Query to fetch name from users table and phone & address from customer table
    const query = `
        SELECT users.username, customer.phone_number, customer.shipping_address
        FROM users
        JOIN customer ON users.user_id = customer.user_id
        WHERE users.user_id = ?
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Database query failed' });
            return;
        }

        if (results.length > 0) {
            console.log("data fetched", results[0]);
            res.json(results[0]); // Send the first result
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

app.get('/best-sellers', (req, res) => {
    try {
        const query = `
            SELECT 
                b.book_id,
                b.title,
                b.author,
                b.cover_image,
                b.description,
                COALESCE(SUM(od.quantity), 0) AS total_sold,
                MAX(d.discount_value) AS discount_value,
                MAX(d.valid_until) AS valid_until
            FROM 
                books b
            JOIN 
                publisher_books pb ON b.book_id = pb.book_id
            LEFT JOIN 
                order_details od ON pb.publisher_book_id = od.publisher_book_id
            LEFT JOIN 
                publisher_book_discounts pbd ON pb.publisher_book_id = pbd.publisher_book_id
            LEFT JOIN 
                discounts d ON pbd.discount_id = d.discount_id
            GROUP BY 
                b.book_id, b.title, b.author, b.cover_image, b.description
            HAVING 
                total_sold >= 1
            ORDER BY 
                total_sold DESC
            LIMIT 4
        `;

        db.query(query, (error, results) => {
            if (error) {
                console.error('Database query error:', error); // Log error for debugging
                res.status(500).json({ error: 'Failed to fetch best-sellers' });
            } else {
                console.log('Best-sellers results:', results); // Debugging log
                res.json(results);
            }
        });
    } catch (err) {
        console.error('Unexpected error:', err); // Handle unexpected server errors
        res.status(500).json({ error: 'Unexpected server error' });
    }
});

// API to get new arrivals
app.get('/api/new-arrivals', (req, res) => {
    const query = `SELECT 
            b.book_id, 
            b.title, 
            b.author, 
            b.cover_image, 
            b.description, 
            MAX(d.discount_value) AS discount_value, 
            MAX(d.valid_until) AS valid_until
        FROM 
            books b
        LEFT JOIN 
            publisher_books pb ON b.book_id = pb.book_id
        LEFT JOIN 
            publisher_book_discounts pbd ON pb.publisher_book_id = pbd.publisher_book_id
        LEFT JOIN 
            discounts d ON pbd.discount_id = d.discount_id
        GROUP BY 
            b.book_id, b.title, b.author, b.cover_image, b.description
        ORDER BY 
            b.created_at DESC
        LIMIT 8; -- Fetch the 8 most recent books`;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).send({ error: 'Failed to fetch new arrivals.' });
        }
        res.json(results);
    });
});

//admin functions
// View all Publishers
app.get('/publishers', async (req, res) => {
    try {
        const query = `SELECT * FROM publisher`;
        db.query(query, [], (error, results) => {
            if (error) {
                console.error('Database Error:', error.message);
                return res.status(500).json({ message: 'Error fetching publishers' });
            }
            res.json(results);
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching publishers' });
    }
});
app.get('/get-publisher/:publisherId', (req, res) => {
    const publisherId = req.params.publisherId;
    const query = `SELECT * FROM publisher WHERE publisher_id = ?`;

    db.query(query, [publisherId], (error, publisher) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to fetch publisher data' });
        }
        if (publisher.length === 0) {
            return res.status(404).json({ error: 'Publisher not found' });
        }
        res.json(publisher[0]);
    });
});

app.put('/publisher/update/:publisherId', authenticateAndFetchRoleId, (req, res) => {
    const publisherId = req.params.publisherId;
    const { approval_status } = req.body;

    // Validate that approval_status is provided
    if (!approval_status) {
        return res.status(400).json({ error: 'Approval status is required' });
    }

    console.log("Attempting to update publisher ID:", publisherId, "with approval status:", approval_status);

    // Query to update the publisher's approval status
    const query = 'UPDATE publisher SET approval_status = ? WHERE publisher_id = ?';

    db.query(query, [approval_status, publisherId], (error, results) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to update publisher' });
        }

        // Check if any rows were affected (publisher found)
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Publisher not found' });
        }

        console.log(`Publisher with ID ${publisherId} updated successfully`);
        res.json({ message: 'Publisher updated successfully' });
    });
});

// Delete Publisher
app.delete('/publisher/delete/:publisherId', async (req, res) => {
    try {

        const publisherId = req.params.publisherId;
        const query = 'DELETE FROM publisher WHERE publisher_id = ?';
        
        db.query(query, [publisherId], (error, results) => {
            if (error) {
                console.error('Error deleting publisher:', error);
                return res.status(500).send({ error: 'Failed to delete publisher' });
            }
            res.json({ message: 'Publisher deleted successfully' });
        });
    } catch (error) {
        console.error('Error deleting publisher:', error);
        res.status(500).send({ error: 'Failed to delete publisher' });
    }
});

app.get('/admin/monthly-sales', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.name AS publisherName,
                SUM(od.quantity * od.price) AS totalSales,
                SUM(od.quantity * od.price * 0.05) AS adminProfit
            FROM orders o
            JOIN order_details od ON od.order_id = o.order_id
            JOIN publisher_books pb ON pb.publisher_book_id = od.publisher_book_id
            JOIN publisher p ON p.publisher_id = pb.publisher_id
            WHERE o.status IN ('shipped', 'delivered') 
              AND MONTH(o.created_at) = MONTH(CURRENT_DATE())
              AND YEAR(o.created_at) = YEAR(CURRENT_DATE())
            GROUP BY p.publisher_id;
        `;

        // Execute the query using db.query() to retrieve results
        db.query(query, (error, results) => {
            if (error) {
                console.error('Error fetching monthly sales:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Internal Server Error',
                    details: error.message
                });
            }

            console.log('Query Results:', results);  // Log the results for debugging

            // Check if results are valid and return them
            if (Array.isArray(results) && results.length > 0) {
                res.json({ success: true, salesData: results });
            } else {
                res.json({ success: false, message: 'No sales data found' });
            }
        });
    } catch (error) {
        console.error('Error fetching monthly sales:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        });
    }
});
// Assuming you're using Express and have a database connection established


app.get('/admin/monthly-sales', authenticateAndFetchRoleId, (req, res) => {
    const role_id = req.user.roleId; // Fetch role ID from the decoded JWT token

    try {
        // Query to get monthly sales data
        const query = `
            SELECT 
                MONTHNAME(o.created_at) AS month,
                SUM(o.total_price) AS sales
            FROM 
                orders o
            WHERE 
                o.status = 'delivered'
            GROUP BY 
                MONTH(o.created_at)
            ORDER BY 
                MONTH(o.created_at);
        `;

        db.query(query, (error, results) => {
            if (error) {
                console.error('Error fetching monthly sales data:', error);
                return res.status(500).json({ error: 'Error fetching sales data' });
            }

            // Prepare the data for sending to the frontend
            const salesData = results.map(row => ({
                month: row.month,
                sales: row.sales
            }));

            // Send the sales data as a response
            res.json({
                success: true,
                salesData: salesData
            });
        });
    } catch (error) {
        console.error('Error processing the request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3306;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
