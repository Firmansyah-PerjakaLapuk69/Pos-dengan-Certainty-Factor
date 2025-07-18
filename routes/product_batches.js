import { Router } from 'express';
import { query } from '../config/db.js';
import { body, validationResult } from 'express-validator';
import moment from 'moment';
import { sendWhatsAppNotification } from '../whatsapp_web.js';

const router = Router();

// Fungsi bantu hitung selisih bulan & hari (menggunakan moment)
function getExpiryDiff(now, expiry) {
  const totalDays = expiry.diff(now, 'days');
  if (totalDays <= 0) return { expired: true, months: 0, days: 0 };

  // Hitung bulan dan hari dengan pendekatan kasar
  const months = expiry.diff(now, 'months');
  const days = expiry.subtract(months, 'months').diff(now, 'days');

  return { expired: false, months, days };
}

// ========================
// GET: List all product batches
// ========================
router.get('/', async (req, res) => {
    try {
        const { rows: batchesRaw } = await query(`
            SELECT 
                pb.*,
                p.name AS product_name
            FROM product_batches pb
            JOIN products p ON pb.product_id = p.id_products
            ORDER BY pb.id_product_batches DESC
        `);

        const batches = batchesRaw.map(batch => ({
            ...batch,
            expiry_date: moment(batch.expiry_date).format('YYYY-MM-DD'),
            created_at: moment(batch.created_at).format('YYYY-MM-DD HH:mm')
        }));

        const { rows: products } = await query('SELECT id_products, name FROM products');

        res.render('product_batches', {
            batches,
            products
        });
    } catch (error) {
        console.error('Error fetching product batches:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// GET: Form to create new batch
// ========================
router.get('/new', async (req, res) => {
    try {
        const { rows: products } = await query('SELECT id_products, name FROM products');
        res.render('product_batch_form', {
            batch: {},
            products,
            action: '/product_batches',
            method: 'POST',
            errors: []
        });
    } catch (error) {
        console.error('Error loading form:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// POST: Create new batch
// ========================
router.post('/', [
    body('product_id').notEmpty().withMessage('Product is required'),
    body('batch_number').notEmpty().withMessage('Batch number is required'),
    body('expiry_date').notEmpty().withMessage('Expiry date is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('purchase_price').isInt({ min: 0 }).withMessage('Purchase price must be a non-negative integer'),
    body('selling_price').isInt({ min: 0 }).withMessage('Selling price must be a non-negative integer')
], async (req, res) => {
    const errors = validationResult(req);
    const { product_id, batch_number, expiry_date, stock, purchase_price, selling_price } = req.body;

    if (!errors.isEmpty()) {
        const { rows: products } = await query('SELECT id_products, name FROM products');
        return res.render('product_batch_form', {
            batch: req.body,
            products,
            action: '/product_batches',
            method: 'POST',
            errors: errors.array()
        });
    }

    const today = moment().format('YYYYMMDD');
    const batchId = `PB${today}${Math.floor(Math.random() * 9000 + 1000)}`;

    try {
        await query(`
            INSERT INTO product_batches (
                id_product_batches, product_id, batch_number, expiry_date, stock, purchase_price, selling_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [batchId, product_id, batch_number, expiry_date, stock, purchase_price, selling_price]);

        const { rows: productRows } = await query('SELECT name FROM products WHERE id_products = $1', [product_id]);
        const productName = productRows[0]?.name || 'Produk Tidak Dikenal';

        // Notifikasi jika stok rendah
        if (stock < 50) {
            await sendWhatsAppNotification(`⚠️ Stok rendah untuk batch ${batch_number} (${productName}) hanya tersisa ${stock} unit.`);
        }

        // Notifikasi jika kadaluarsa dalam 6 bulan atau sudah kadaluarsa
        const now = moment();
        const expiry = moment(expiry_date);

        const diff = getExpiryDiff(now, expiry);

        if (diff.expired) {
        await sendWhatsAppNotification(`❌ Batch ${batch_number} (${productName}) telah kadaluwarsa pada ${expiry.format('MMMM YYYY')}.`);
        } else if (diff.months > 0) {
        await sendWhatsAppNotification(`📦 Batch ${batch_number} (${productName}) akan kedaluwarsa dalam ${diff.months} bulan ${diff.days} hari.`);
        } else if (diff.months === 0 && diff.days > 0) {
        await sendWhatsAppNotification(`⚠️ Batch ${batch_number} (${productName}) akan kedaluwarsa dalam ${diff.days} hari.`);
        }

        res.redirect(`/product_batches?success=add&id=${batchId}`);
    } catch (error) {
        console.error('Error adding product batch:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// GET: Edit form
// ========================
router.get('/:id_product_batches/edit', async (req, res) => {
    const { id_product_batches } = req.params;
    try {
        const { rows } = await query('SELECT * FROM product_batches WHERE id_product_batches = $1', [id_product_batches]);

        if (rows.length === 0) return res.status(404).send('Batch not found');

        const batch = rows[0];
        batch.expiry_date = moment(batch.expiry_date).format('YYYY-MM-DD');

        const { rows: products } = await query('SELECT id_products, name FROM products');

        res.render('product_batch_form', {
            batch,
            products,
            action: `/product_batches/${id_product_batches}?_method=PUT`,
            method: 'POST',
            errors: []
        });
    } catch (error) {
        console.error('Error loading edit form:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// PUT: Update batch
// ========================
router.put('/:id_product_batches', async (req, res) => {
    const { id_product_batches } = req.params;
    const { product_id, batch_number, expiry_date, stock, purchase_price, selling_price } = req.body;

    try {
        const result = await query(`
            UPDATE product_batches
            SET product_id = $1,
                batch_number = $2,
                expiry_date = $3,
                stock = $4,
                purchase_price = $5,
                selling_price = $6
            WHERE id_product_batches = $7
        `, [product_id, batch_number, expiry_date, stock, purchase_price, selling_price, id_product_batches]);

        const { rows: productRows } = await query('SELECT name FROM products WHERE id_products = $1', [product_id]);
        const productName = productRows[0]?.name || 'Produk Tidak Dikenal';

        // Notifikasi jika stok rendah
        if (stock < 50) {
            await sendWhatsAppNotification(`⚠️ Stok rendah untuk batch ${batch_number} (${productName}) hanya tersisa ${stock} unit.`);
        }

        // Setelah insert/update batch dan cek stok rendah:

        const now = moment();
        const expiry = moment(expiry_date);

        const diff = getExpiryDiff(now, expiry);

        if (diff.expired) {
        await sendWhatsAppNotification(`❌ Batch ${batch_number} (${productName}) telah kadaluwarsa pada ${expiry.format('MMMM YYYY')}.`);
        } else if (diff.months > 0) {
        await sendWhatsAppNotification(`📦 Batch ${batch_number} (${productName}) akan kedaluwarsa dalam ${diff.months} bulan ${diff.days} hari.`);
        } else if (diff.months === 0 && diff.days > 0) {
        await sendWhatsAppNotification(`⚠️ Batch ${batch_number} (${productName}) akan kedaluwarsa dalam ${diff.days} hari.`);
        }

        if (result.rowCount > 0) {
            res.redirect(`/product_batches?success=edit&id=${id_product_batches}`);
        } else {
            res.status(404).send('Batch not found');
        }
    } catch (error) {
        console.error('Error updating product batch:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// DELETE: Delete batch
// ========================
router.delete('/:id_product_batches', async (req, res) => {
    const { id_product_batches } = req.params;

    try {
        const result = await query('DELETE FROM product_batches WHERE id_product_batches = $1', [id_product_batches]);

        if (result.rowCount > 0) {
            res.redirect(`/product_batches?success=delete&id=${id_product_batches}`);
        } else {
            res.status(404).send('Batch not found');
        }
    } catch (error) {
        console.error('Error deleting product batch:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
