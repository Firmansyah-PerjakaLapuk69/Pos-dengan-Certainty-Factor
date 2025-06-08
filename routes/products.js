import { Router } from 'express';
import { query } from '../config/db.js';
import moment from 'moment';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// Multer Setup for product_image
// ==============================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'public', 'img', 'productimg'); // Sesuai permintaan
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/\s+/g, '_').toLowerCase();
        cb(null, `${base}_${timestamp}${ext}`);
    }
});

const upload = multer({ storage });

// ==============================
// Generate Product ID: PYYYYMMDD0001
// ==============================
async function generateProductId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    try {
        const result = await query(
            `SELECT id_products FROM products WHERE id_products LIKE $1 ORDER BY id_products DESC LIMIT 1`,
            [`P${datePart}%`]
        );

        let sequence = 1;
        if (result.rows.length > 0) {
            const lastId = result.rows[0].id_products;
            sequence = parseInt(lastId.slice(-4)) + 1;
        }

        return `P${datePart}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating product ID:', error);
        throw new Error('Error generating product ID');
    }
}

// Fetch all products
router.get('/', async (req, res) => {
    try {
        // Fetch products
        const { rows: products } = await query(
            `SELECT p.*, c.name AS category_name, u.name AS unit_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id_categories
            LEFT JOIN units u ON p.unit_id = u.id_units
            ORDER BY p.created_at DESC`
        );

        // Fetch categories & units untuk form
        const { rows: categories } = await query('SELECT * FROM categories');
        const { rows: units } = await query('SELECT * FROM units');

        // Format created_at ke format YYYY-MM-DD/HH:mm GMT+7
        products.forEach(product => {
            if (product.created_at) {
                const gmt7Time = moment(product.created_at).utcOffset(7);
                product.created_at = gmt7Time.format('YYYY-MM-DD HH:mm');
            }
        });

        // Render ke view
        res.render('products', { products, categories, units });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ==============================
// GET: Add Product Form
// ==============================
router.get('/new', async (req, res) => {
    try {
        const { rows: categories } = await query('SELECT * FROM categories');
        const { rows: units } = await query('SELECT * FROM units');

        res.render('form_product', {
            categories,
            units,
            product: {},
            action: '/products',
            method: 'POST',
            errors: [],
        });
    } catch (error) {
        console.error('Error fetching categories or units:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ==============================
// POST: Add Product
// ==============================
router.post('/', upload.single('product_image'), [
    body('name').notEmpty().withMessage('Product name is required'),
    body('category_id').notEmpty().withMessage('Category is required'),
    body('unit_id').notEmpty().withMessage('Unit is required'),
    body('barcode').notEmpty().withMessage('Barcode is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const { rows: categories } = await query('SELECT * FROM categories');
        const { rows: units } = await query('SELECT * FROM units');

        return res.render('form_product', {
            product: req.body,
            categories,
            units,
            action: '/products',
            method: 'POST',
            errors: errors.array(),
        });
    }

    const { name, barcode, category_id, brand, description, unit_id } = req.body;
    const product_image = req.file ? `/img/productimg/${req.file.filename}` : null;

    try {
        const id = await generateProductId();

        await query(
            `INSERT INTO products (id_products, name, barcode, category_id, brand, description, unit_id, product_image, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())`,
            [id, name, barcode, category_id, brand, description, unit_id, product_image]
        );

        res.redirect(`/products?success=add&id=${id}`);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// GET: Edit Product Form
// ========================
router.get('/:id_products/edit', async (req, res) => {
    try {
        const { id_products } = req.params;

        // Ambil data produk
        const { rows } = await query('SELECT * FROM products WHERE id_products = $1', [id_products]);

        if (rows.length === 0) return res.status(404).send('Product not found');

        const product = rows[0];

        // Ambil kategori & satuan
        const { rows: categories } = await query('SELECT id_categories, name FROM categories');
        const { rows: units } = await query('SELECT id_units, name FROM units');

        // Construct action URL untuk form
        const action = `/products/${id_products}?_method=PUT`;

        // Render form
        res.render('product_form', {
            product,
            action,
            categories,
            units,
            errors: [],
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// PUT: Update Product
// ========================
router.put('/:id_products', upload.single('product_image'), async (req, res) => {
    const { id_products } = req.params;
    const {
        name, barcode, category_id, brand, description,
        unit_id, status
    } = req.body;

    let product_image = null;

    try {
        // Get existing product image if no new file uploaded
        const { rows: existing } = await query('SELECT product_image FROM products WHERE id_products = $1', [id_products]);
        const oldImagePath = existing[0]?.product_image;

        if (req.file) {
            // Nama file baru berdasarkan nama produk, dan gunakan ekstensi file yang sesuai
            const extension = path.extname(req.file.originalname);  // Mendapatkan ekstensi file
            product_image = `/img/productimg/${name.replace(/\s+/g, '_').toLowerCase()}${extension}`;

            // Remove old image if exists
            if (oldImagePath) {
                const fullOldPath = path.join(__dirname, '..', 'public', oldImagePath);
                if (fs.existsSync(fullOldPath)) {
                    fs.unlinkSync(fullOldPath);
                    console.log(`Deleted old image: ${fullOldPath}`);
                }
            }
            // Save the new image file to the specified path
            const newImagePath = path.join(__dirname, '..', 'public', product_image);
            fs.renameSync(req.file.path, newImagePath);  // Ganti lokasi file gambar
        } else {
            product_image = oldImagePath || null;
        }

        // Update database
        await query(`
            UPDATE products 
            SET name = $1, barcode = $2, category_id = $3, brand = $4,
                description = $5, unit_id = $6, product_image = $7, status = $8
            WHERE id_products = $9
        `, [name, barcode, category_id, brand, description, unit_id, product_image, status, id_products]);

        res.redirect(`/products?success=edit&id=${id_products}`);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Delete product

router.delete('/:id_products', async (req, res) => {
    try {
        const { id_products } = req.params;

        // Ambil nama file gambar dari database
        const { rows } = await query('SELECT product_image FROM products WHERE id_products = $1', [id_products]);

        if (rows.length > 0 && rows[0].product_image) {
            const imagePath = path.join(__dirname, '..', 'public', rows[0].product_image);

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log(`Gambar berhasil dihapus: ${imagePath}`);
            } else {
                console.warn(`Gambar tidak ditemukan: ${imagePath}`);
            }
        }

        // Hapus data produk dari database
        await query('DELETE FROM products WHERE id_products = $1', [id_products]);

        res.redirect(`/products?success=delete&id=${id_products}`);
    } catch (error) {
        console.error('Gagal menghapus produk:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
