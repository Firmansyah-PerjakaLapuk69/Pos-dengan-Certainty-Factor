import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { body, validationResult } from 'express-validator';
import PDFDocument from 'pdfkit';
import streamBuffers from 'stream-buffers';
import { sendWhatsAppNotification } from '../whatsapp_web.js';

const router = Router();
const LOW_STOCK_THRESHOLD = 50;

router.get('/', async (req, res) => {
    try {
        const { rows: items } = await query(`
            SELECT 
                ti.id_transactions,
                ti.id_products,
                ti.id_product_batches,
                ti.quantity,
                ti.price,
                ti.discount_amount,
                ti.subtotal,
                p.name AS product_name,
                pb.batch_number
            FROM transaction_items ti
            JOIN products p ON ti.id_products = p.id_products
            JOIN product_batches pb ON ti.id_product_batches = pb.id_product_batches
            ORDER BY ti.id_transactions DESC
        `);

        const { rows: transactions } = await query(`
            SELECT id_transactions
            FROM transactions
            WHERE total_price = 0
              AND status = 'unpaid'
              AND id_transactions NOT IN (
                  SELECT DISTINCT id_transactions FROM transaction_items
              )
        `);

        const { rows: users } = await query('SELECT id_users, name FROM users_pos');
        const { rows: products } = await query('SELECT id_products, name FROM products');
        const { rows: batches } = await query('SELECT id_product_batches, batch_number, selling_price FROM product_batches');

        res.render('transaction_items', { items, transactions, users, products, batches });
    } catch (error) {
        console.error('Error fetching transaction items:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/batches/:productId', async (req, res) => {
    const { productId } = req.params;
    try {
        const { rows: batches } = await query(`
            SELECT id_product_batches, batch_number, selling_price, stock
            FROM product_batches
            WHERE product_id = $1
        `, [productId]);

        res.json(batches);
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

router.get('/receipt/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { rows: items } = await query(`
            SELECT 
                ti.quantity, ti.price, ti.discount_amount, ti.subtotal,
                p.name AS product_name,
                pb.batch_number,
                t.payment_amount, t.change_amount, t.payment_method, t.total_price,
                t.created_at
            FROM transaction_items ti
            JOIN products p ON ti.id_products = p.id_products
            JOIN product_batches pb ON ti.id_product_batches = pb.id_product_batches
            JOIN transactions t ON ti.id_transactions = t.id_transactions
            WHERE ti.id_transactions = $1
        `, [id]);

        if (items.length === 0) {
            return res.status(404).send('Transaction not found');
        }

        const doc = new PDFDocument({ margin: 50 });
        const bufferStream = new streamBuffers.WritableStreamBuffer();
        doc.pipe(bufferStream);

        const rupiah = (value) =>
            new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(value);

        doc.fontSize(18).font('Helvetica-Bold').text('TOKO SUKSES SELALU', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text('Jl. Contoh No. 123, Jakarta', { align: 'center' });
        doc.text('Telp: 021-12345678 | Email: admin@tokosukses.co.id', { align: 'center' });
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('INVOICE', { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        doc.text(`No Transaksi : T${id}`);
        doc.text(`Tanggal       : ${new Date(items[0].created_at).toLocaleDateString('id-ID')}`);
        doc.text(`Metode Bayar  : ${items[0].payment_method}`);
        doc.moveDown(1);

        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('No', 50, tableTop);
        doc.text('Produk', 80, tableTop);
        doc.text('Batch', 230, tableTop);
        doc.text('Qty', 300, tableTop, { width: 40, align: 'right' });
        doc.text('Harga', 340, tableTop, { width: 70, align: 'right' });
        doc.text('Diskon', 420, tableTop, { width: 80, align: 'right' });
        doc.text('Subtotal', 480, tableTop, { width: 90, align: 'right' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica');

        items.forEach((item, index) => {
            const y = doc.y;
            const price = parseFloat(item.price);
            const discountPerUnit = parseFloat(item.discount_amount || 0);
            const quantity = item.quantity;

            const totalDiscount = discountPerUnit * quantity;
            const discountPercentage = (discountPerUnit / price) * 100;
            doc.text(index + 1, 50, y);
            doc.text(item.product_name, 80, y);
            doc.text(item.batch_number, 230, y);
            doc.text(item.quantity.toString(), 300, y, { width: 40, align: 'right' });
            doc.text(rupiah(item.price), 350, y, { width: 70, align: 'right' });
            doc.text(rupiah(totalDiscount), 420, y, { width: 80, align: 'right' });
            doc.text(`(${discountPercentage.toFixed(1)}%)`, 420, y + 14, { width: 80, align: 'right' });
            doc.text(rupiah(item.subtotal), 490, y, { width: 90, align: 'right' });
            doc.moveDown(1.2);
        });

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.5);

        const total = items[0].total_price;
        const paid = items[0].payment_amount;
        const change = items[0].change_amount;

        doc.font('Helvetica-Bold');
        doc.text(`Total       : ${rupiah(total)}`, 480, doc.y, { align: 'right' });
        doc.text(`Dibayar     : ${rupiah(paid)}`, 480, doc.y, { align: 'right' });
        doc.text(`Kembalian   : ${rupiah(change)}`, 480, doc.y, { align: 'right' });

        doc.moveDown(2);
        doc.font('Helvetica-Oblique').fontSize(10).text('Terima kasih atas kepercayaan Anda.', { align: 'center' });
        doc.text('Semoga Anda puas dengan layanan kami.', { align: 'center' });

        doc.end();

        bufferStream.on('finish', () => {
            const pdfBuffer = bufferStream.getContents();
            res.setHeader('Content-disposition', `inline; filename=invoice-${id}.pdf`);
            res.setHeader('Content-type', 'application/pdf');
            res.send(pdfBuffer);
        });

    } catch (err) {
        console.error('Error generating receipt PDF:', err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/', [
    body('id_transactions').notEmpty().withMessage('Transaction ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items must be an array with at least one item'),
    body('items.*.id_products').notEmpty().withMessage('Product ID is required for each item'),
    body('items.*.id_product_batches').notEmpty().withMessage('Batch ID is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be greater than 0'),
    body('items.*.price').isDecimal({ decimal_digits: '0,2' }).withMessage('Price must be a valid decimal'),
    body('items.*.discount_amount').optional().isDecimal({ decimal_digits: '0,2' }).withMessage('Discount amount must be a valid decimal'),
    body('status').optional().isIn(['unpaid', 'paid']).withMessage('Invalid status'),
    body('payment_amount').optional().isDecimal({ decimal_digits: '0,2' }).withMessage('Payment amount must be a valid decimal'),
    body('change_amount').optional().isDecimal({ decimal_digits: '0,2' }).withMessage('Change amount must be a valid decimal'),
    body('payment_method').optional().isString().trim().escape(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        id_transactions,
        user_id,
        items,
        status = 'unpaid',
        payment_amount = 0,
        change_amount = 0,
        payment_method = null
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validasi stok
        for (const item of items) {
            const stockRes = await client.query(`
                SELECT stock FROM product_batches WHERE id_product_batches = $1
            `, [item.id_product_batches]);

            const stock = stockRes.rows[0]?.stock;

            if (stock === undefined) {
                throw new Error(`Batch ${item.id_product_batches} tidak ditemukan`);
            }

            if (stock === 0) {
                const batchInfoRes = await client.query(`
                    SELECT pb.batch_number, p.name AS product_name
                    FROM product_batches pb
                    JOIN products p ON pb.product_id = p.id_products
                    WHERE pb.id_product_batches = $1
                `, [item.id_product_batches]);

                const info = batchInfoRes.rows[0];
                const message = `❌ *Stok Habis!*\nBatch *${info.batch_number}* (${info.product_name}) sudah HABIS (stok = 0) dan tidak bisa digunakan untuk transaksi.`;
                await sendWhatsAppNotification(message);

                throw new Error(`Batch ${item.id_product_batches} stok 0/habis, tidak bisa digunakan`);
            }

            if (stock < item.quantity) {
                throw new Error(`Stok tidak cukup untuk batch ${item.id_product_batches}. Sisa: ${stock}`);
            }
        }

        // Insert transaction items dengan diskon dan update stock
        for (const item of items) {
            // Pastikan discount_amount valid dan tidak lebih besar dari price
            const price = parseFloat(item.price);
            const discount = parseFloat(item.discount_amount || 0);
            if (discount < 0) throw new Error('Discount amount tidak boleh negatif');
            if (discount > price) throw new Error('Discount amount tidak boleh lebih besar dari harga');

            const quantity = parseInt(item.quantity);
            const subtotal = (price - discount) * quantity;

            await client.query(`
                INSERT INTO transaction_items
                (id_transactions, id_products, id_product_batches, quantity, price, discount_amount, subtotal)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                id_transactions,
                item.id_products,
                item.id_product_batches,
                quantity,
                price,
                discount,
                subtotal
            ]);

            await client.query(`
                UPDATE product_batches
                SET stock = stock - $1
                WHERE id_product_batches = $2
            `, [quantity, item.id_product_batches]);

            const updatedStockRes = await client.query(`
                SELECT pb.stock, pb.batch_number, p.name AS product_name
                FROM product_batches pb
                JOIN products p ON pb.product_id = p.id_products
                WHERE pb.id_product_batches = $1
            `, [item.id_product_batches]);

            const updated = updatedStockRes.rows[0];
            if (updated?.stock < LOW_STOCK_THRESHOLD) {
                const message = `⚠️ *Stok Rendah!*\nStok rendah untuk batch *${updated.batch_number}* (${updated.product_name}) hanya tersisa *${updated.stock}* unit.`;
                await sendWhatsAppNotification(message);
            }
        }

        // Hitung total dengan diskon
        const totalPrice = items.reduce((sum, item) => {
            const discount = parseFloat(item.discount_amount || 0);
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity);
            return sum + ((price - discount) * quantity);
        }, 0);

        await client.query(`
            UPDATE transactions
            SET total_price = $1,
                status = $2,
                payment_amount = $3,
                change_amount = $4,
                payment_method = $5,
                user_id = $6
            WHERE id_transactions = $7
        `, [totalPrice, status, payment_amount, change_amount, payment_method, user_id, id_transactions]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Transaction items added and transaction updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ========================
// GET: Edit form
// ========================
router.get('/:id_transactions/:id_products/:id_product_batches/edit', async (req, res) => {
    const { id_transactions, id_products, id_product_batches } = req.params;

    try {
        const { rows } = await query(
            `SELECT * FROM transaction_items 
             WHERE id_transactions = $1 AND id_products = $2 AND id_product_batches = $3`,
            [id_transactions, id_products, id_product_batches]
        );

        if (rows.length === 0) return res.status(404).send('Transaction item not found');

        const item = rows[0];
        const { rows: transactions } = await query('SELECT id_transactions FROM transactions');
        const { rows: products } = await query('SELECT id_products, name FROM products');
        const { rows: batches } = await query('SELECT id_product_batches, batch_number, selling_price FROM product_batches');

        res.render('transaction_item_form', {
            item,
            transactions,
            products,
            batches,
            action: `/transaction_items/${id_transactions}/${id_products}/${id_product_batches}?_method=PUT`,
            method: 'POST',
            errors: [],
        });
    } catch (error) {
        console.error('Error loading edit form:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// PUT: Update item
// ========================
router.put('/:id_transactions/:id_products/:id_product_batches', async (req, res) => {
    const { id_transactions, id_products, id_product_batches } = req.params;
    const { quantity, price } = req.body;
    const subtotal = quantity * price;

    try {
        const result = await query(`
            UPDATE transaction_items
            SET quantity = $1, price = $2, subtotal = $3
            WHERE id_transactions = $4 AND id_products = $5 AND id_product_batches = $6
        `, [quantity, price, subtotal, id_transactions, id_products, id_product_batches]);

        if (result.rowCount > 0) {
            res.redirect('/transaction_items?success=edit');
        } else {
            res.status(404).send('Transaction item not found');
        }
    } catch (error) {
        console.error('Error updating transaction item:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// DELETE: Delete item
// ========================
router.delete('/:id_transactions/:id_products/:id_product_batches', async (req, res) => {
    const { id_transactions, id_products, id_product_batches } = req.params;

    try {
        const result = await query(`
            DELETE FROM transaction_items 
            WHERE id_transactions = $1 AND id_products = $2 AND id_product_batches = $3
        `, [id_transactions, id_products, id_product_batches]);

        if (result.rowCount > 0) {
            res.redirect('/transaction_items?success=delete');
        } else {
            res.status(404).send('Transaction item not found');
        }
    } catch (error) {
        console.error('Error deleting transaction item:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
