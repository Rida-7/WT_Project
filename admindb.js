const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(
    cors({
        origin: ['http://localhost:5051', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501', 'http://localhost:3000', 'http://localhost:8082'],
        credentials: true,
    })
);
app.use(express.json());

// Database connection
const db = mysql
    .createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Lenovo@17', // Update this to your database password
        database: 'BookStore', // Update this to your database name
    })
    .promise();

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        throw err;
    }
    console.log('Connected to MySQL!');
});

// Utility function for database queries
async function executeQuery(query, params) {
    try {
        const [result] = await db.query(query, params);
        return result;
    } catch (error) {
        console.error('Database Error:', error.message);
        throw new Error(error.message);
    }
}

// -------------------- Publisher Endpoints --------------------

// View all Publishers
app.get('/publishers', async (req, res) => {
    try {
        const query = `SELECT * FROM publisher`;
        const results = await executeQuery(query, []);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching publishers' });
    }
});
// GET Route to fetch publisher data by ID
app.get('/get-publisher/:publisherId', async (req, res) => {
    const publisherId = req.params.publisherId;
    
    try {
        // Query the database to fetch the publisher details
        const query = `SELECT * FROM publisher WHERE publisher_id = ?`;
        const publisher = await executeQuery(query, [publisherId]);

        // Check if the publisher exists
        if (publisher.length === 0) {
            return res.status(404).json({ error: 'Publisher not found' });
        }

        // Send the publisher data as a response
        res.json(publisher[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch publisher data' });
    }
});

app.get('/get-category/:categoryId', async (req, res) => {
    const categoryId = req.params.categoryId;

    try {
        // Query the database to fetch the category details
        const query = `SELECT * FROM categories WHERE category_id = ?`;
        const category = await executeQuery(query, [categoryId]);

        // Check if the category exists
        if (category.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Send the category data as a response
        res.json(category[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch category data' });
    }
});


// Update Publisher
app.put('/publisher/update/:publisherId', async (req, res) => {
    try {
        const publisherId = req.params.publisherId;
        const { name, company_name, phone_number, address, legal_document, approval_status, approval_date } = req.body;

        if (!name || !company_name || !phone_number || !address || !legal_document) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const query = `
            UPDATE publisher
            SET name = ?, company_name = ?, phone_number = ?, address = ?, legal_document = ?, approval_status = ?, approval_date = ?
            WHERE publisher_id = ?`;
        await executeQuery(query, [name, company_name, phone_number, address, legal_document, approval_status, approval_date, publisherId]);

        res.json({ message: 'Publisher updated successfully' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update publisher' });
    }
});

// Delete Publisher
app.delete('/publisher/delete/:publisherId', async (req, res) => {
    try {
        const publisherId = req.params.publisherId;
        const query = 'DELETE FROM publisher WHERE publisher_id = ?';
        await executeQuery(query, [publisherId]);
        res.json({ message: 'Publisher deleted successfully' });
    } catch (error) {
        console.error('Error deleting publisher:', error);
        res.status(500).send({ error: 'Failed to delete publisher' });
    }
});

// -------------------- Category Endpoints --------------------
app.post('/categories/add', async (req, res) => {
    const { name } = req.body;  // We only need category_name

    // Validate the input data
    if (!name) {
        return res.status(400).json({ error: 'Category Name is required' });
    }

    try {
        // Insert the new category into the 'categories' table
        const query = 'INSERT INTO categories (name) VALUES (?)';
        const result = await executeQuery(query, [name]);

        // Send success response, with the inserted category's ID (auto-incremented)
        res.json({
            message: 'Category added successfully',
            categoryId: result.insertId  // This will return the auto-generated category_id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add category' });
    }
});


// View all Categories
// Endpoint to fetch categories
app.get('/categories', async (req, res) => {
    try {
      // Query the database to get all categories
      const query = 'SELECT * FROM categories';  // Make sure the table name is correct
      const categories = await executeQuery(query);
  
      // Return the categories as JSON
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });
  

// Update Category
app.put('/get-category/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category_description } = req.body;

        const query = `UPDATE categories SET name = ?, category_description = ? WHERE category_id = ?`;
        await executeQuery(query, [name, category_description, id]);

        res.json({ message: 'Category updated successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Category
app.delete('/category/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `DELETE FROM categories WHERE category_id = ?`;
        await executeQuery(query, [id]);
        res.json({ message: 'Category deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------- Customer Endpoints --------------------
// View Customer by ID
app.get('/customer/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT customer_id, name, email, phone_number, shipping_address, account_status 
            FROM customers 
            WHERE customer_id = ?`;
        const customer = await executeQuery(query, [id]);

        if (customer.length === 0) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Customer
app.put('/customer/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone_number, shipping_address, account_status } = req.body;

        const query = `
            UPDATE customers 
            SET name = ?, phone_number = ?, shipping_address = ?, account_status = ? 
            WHERE customer_id = ?`;
        await executeQuery(query, [name, phone_number, shipping_address, account_status, id]);

        res.json({ message: 'Customer updated successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Customer
app.delete('/customer/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `DELETE FROM customers WHERE customer_id = ?`;
        await executeQuery(query, [id]);
        res.json({ message: 'Customer deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------- Server Start --------------------
app.listen(8082, () => {
    console.log('Server is running on http://localhost:8082');
});
