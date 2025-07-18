import { Router } from 'express';
import { query } from '../config/db.js';
import { body, validationResult } from 'express-validator';

const router = Router();

// Fungsi untuk generate ID unit otomatis (UYYYYMMDD0001)
async function generateUnitId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    try {
        const result = await query(
            `SELECT id_units FROM units WHERE id_units LIKE $1 ORDER BY id_units DESC LIMIT 1`,
            [`U${datePart}%`]
        );

        let sequence = 1;
        if (result.rows.length > 0) {
            const lastId = result.rows[0].id_units;
            sequence = parseInt(lastId.slice(-4)) + 1;
        }

        return `U${datePart}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating unit ID:', error);
        throw new Error('Error generating unit ID');
    }
}

// Tampilkan semua unit
router.get('/', async (req, res) => {
    try {
        const { rows: units } = await query('SELECT * FROM units ORDER BY id_units DESC');
        res.render('units', { units });
    } catch (error) {
        console.error('Error fetching units:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Render form tambah unit baru
router.get('/new', (req, res) => {
    res.render('form_unit', {
        unit: {},
        action: '/units',
        method: 'POST',
        errors: [],
    });
});

// Tambah unit baru
router.post('/', [
    body('name').notEmpty().withMessage('Unit name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('form_unit', {
            unit: req.body,
            action: '/units',
            method: 'POST',
            errors: errors.array(),
        });
    }

    const { name } = req.body;

    try {
        const id = await generateUnitId();  // Generate the unit ID
        await query(`INSERT INTO units (id_units, name) VALUES ($1, $2)`, [id, name]);

        // Redirect setelah menambah unit
        res.redirect(`/units?success=add&id_units=${id}`); // Use `id` instead of `unit.id_units`
    } catch (error) {
        console.error('Error adding unit:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Edit unit
router.get('/:id_units/edit', async (req, res) => {
    const { id_units } = req.params;

    try {
        const { rows } = await query('SELECT * FROM units WHERE id_units = $1', [id_units]);

        if (rows.length === 0) return res.status(404).send('Unit not found');

        const unit = rows[0];
        const action = `/units/${id_units}?_method=PUT`;

        res.render('form_unit', {
            unit,
            action,
            method: 'POST',
            errors: [],
        });
    } catch (error) {
        console.error('Error fetching unit:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Update unit
router.put('/:id_units', async (req, res) => {
    const { id_units } = req.params;
    const { name } = req.body;

    try {
        await query(`UPDATE units SET name = $1 WHERE id_units = $2`, [name, id_units]);
        // Redirect setelah mengedit unit
        res.redirect(`/units?success=edit&id_units=${id_units}`); // Use `id_units` from params
    } catch (error) {
        console.error('Error updating unit:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Hapus unit
router.delete('/:id_units', async (req, res) => {
    const { id_units } = req.params;

    try {
        await query('DELETE FROM units WHERE id_units = $1', [id_units]);
        res.redirect(`/units?success=delete&id_units=${id_units}`); 
    } catch (error) {
        console.error('Error deleting unit:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
