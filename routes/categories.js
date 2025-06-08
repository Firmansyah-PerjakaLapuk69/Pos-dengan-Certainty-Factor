import { Router } from 'express';
import { query } from '../config/db.js';
import { body, validationResult } from 'express-validator';

const router = Router();

// Fungsi untuk generate ID kategori otomatis (CYYYYMMDD0001)
async function generateCategoryId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    try {
        const result = await query(
            `SELECT id_categories FROM categories WHERE id_categories LIKE $1 ORDER BY id_categories DESC LIMIT 1`,
            [`C${datePart}%`]
        );

        let sequence = 1;
        if (result.rows.length > 0) {
            const lastId = result.rows[0].id_categories;
            sequence = parseInt(lastId.slice(-4)) + 1;
        }

        return `C${datePart}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating category ID:', error);
        throw new Error('Error generating category ID');
    }
}

// Tampilkan semua kategori
router.get('/', async (req, res) => {
    try {
        const { rows: categories } = await query('SELECT * FROM categories ORDER BY id_categories DESC');
        res.render('categories', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Render form tambah kategori baru
router.get('/new', (req, res) => {
    res.render('form_category', {
        category: {},
        action: '/categories',
        method: 'POST',
        errors: [],
    });
});

// Tambah kategori baru
router.post('/', [
    body('name').notEmpty().withMessage('Category name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('form_category', {
            category: req.body,
            action: '/categories',
            method: 'POST',
            errors: errors.array(),
        });
    }

    const { name } = req.body;

    try {
        const id = await generateCategoryId();
        await query(`INSERT INTO categories (id_categories, name) VALUES ($1, $2)`, [id, name]);
        res.redirect(`/categories?success=add&id_categories=${id}`);
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Edit kategori
router.get('/:id_categories/edit', async (req, res) => {
    const { id_categories } = req.params;

    try {
        const { rows } = await query('SELECT * FROM categories WHERE id_categories = $1', [id_categories]);

        if (rows.length === 0) return res.status(404).send('Category not found');

        const category = rows[0];
        const action = `/categories/${id_categories}?_method=PUT`;

        res.render('form_category', {
            category,
            action,
            method: 'POST',
            errors: [],
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Update kategori
router.put('/:id_categories', async (req, res) => {
    const { id_categories } = req.params;
    const { name } = req.body;

    try {
        await query(`UPDATE categories SET name = $1 WHERE id_categories = $2`, [name, id_categories]);
        res.redirect(`/categories?success=edit&id_categories=${id_categories}`);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Hapus kategori
router.delete('/:id_categories', async (req, res) => {
    const { id_categories } = req.params;

    try {
        await query('DELETE FROM categories WHERE id_categories = $1', [id_categories]);
        res.redirect(`/categories?success=delete&id_categories=${id_categories}`);
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;