import { Router } from 'express';
import { query } from '../config/db.js';
import { body, validationResult } from 'express-validator';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import moment from 'moment';

const router = Router();

// ========================
// GET: List all transactions
// ========================
router.get('/', async (req, res) => {
    try {
        const { rows: transactionsRaw } = await query(`
            SELECT 
                t.*, 
                u.name AS user_name
            FROM transactions t
            LEFT JOIN users_pos u ON t.user_id = u.id_users
            ORDER BY t.created_at DESC
        `);

        const transactions = transactionsRaw.map(t => ({
            ...t,
            created_at: moment(t.created_at).format('YYYY-MM-DD HH:mm')
        }));

        const { rows: users } = await query('SELECT id_users, name FROM users_pos');

        res.render('transactions', {
            transactions,
            users
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// POST: Generate multiple dummy transactions
// ========================
router.post('/generate', async (req, res) => {
    try {
        const { count } = req.body;
        if (!count || count < 1) return res.status(400).send('Invalid count');

        const today = moment().format('YYYYMMDD');

        // Cari nomor urut terakhir berdasarkan prefix tanggal hari ini
        const { rows } = await query(`
            SELECT id_transactions FROM transactions
            WHERE id_transactions LIKE 'T${today}%'
            ORDER BY id_transactions DESC
            LIMIT 1
        `);

        let lastNumber = 0;
        if (rows.length > 0) {
            // Ambil 4 digit terakhir sebagai nomor urut terakhir
            lastNumber = parseInt(rows[0].id_transactions.slice(-4), 10);
        }

        const generated = [];

        for (let i = 1; i <= count; i++) {
            const nextNumber = lastNumber + i;
            const nextNumberPadded = nextNumber.toString().padStart(4, '0');
            const transactionId = `T${today}${nextNumberPadded}`;

            const dummyTransaction = {
                id_transactions: transactionId,
                user_id: null,
                total_price: 0,
                payment_amount: 0,
                change_amount: 0,
                status: 'unpaid',
                payment_method: 'cash',
            };

            await query(
              `INSERT INTO transactions 
                (id_transactions, user_id, total_price, payment_amount, change_amount, status, payment_method)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
               [
                dummyTransaction.id_transactions,
                dummyTransaction.user_id,
                dummyTransaction.total_price,
                dummyTransaction.payment_amount,
                dummyTransaction.change_amount,
                dummyTransaction.status,
                dummyTransaction.payment_method,
               ]
            );

            generated.push(transactionId);
        }

        res.json({ generated: generated.length });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// ========================
// GET: Form tambah transaksi
// ========================
router.get('/new', async (req, res) => {
    try {
        const { rows: users } = await query('SELECT id_users, name FROM users_pos');
        res.render('transaction_form', {
            transaction: {},
            users,
            action: '/transactions',
            method: 'POST',
            errors: []
        });
    } catch (error) {
        console.error('Error loading form:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// POST: Tambah transaksi
// ========================
router.post('/', [
    body('user_id').notEmpty().withMessage('User is required'),
    body('total_price').isDecimal({ min: 0 }).withMessage('Total price must be a positive number'),
    body('payment_amount').isDecimal({ min: 0 }).withMessage('Payment amount must be a positive number'),
    body('payment_method').notEmpty().withMessage('Payment method is required'),
], async (req, res) => {
    const errors = validationResult(req);
    const { user_id, total_price, payment_amount, payment_method } = req.body;

    if (!errors.isEmpty()) {
        const { rows: users } = await query('SELECT id_users, name FROM users_pos');
        return res.render('transaction_form', {
            transaction: req.body,
            users,
            action: '/transactions',
            method: 'POST',
            errors: errors.array()
        });
    }

    const change_amount = parseFloat(payment_amount) - parseFloat(total_price);
    const today = moment().format('YYYYMMDD');

    try {
        // Cari nomor urut terakhir hari ini
        const { rows } = await query(`
            SELECT id_transactions FROM transactions
            WHERE id_transactions LIKE 'T${today}%'
            ORDER BY id_transactions DESC
            LIMIT 1
        `);

        let lastNumber = 0;
        if (rows.length > 0) {
            lastNumber = parseInt(rows[0].id_transactions.slice(-4), 10);
        }

        const nextNumber = lastNumber + 1;
        const nextNumberPadded = nextNumber.toString().padStart(4, '0');
        const transactionId = `T${today}${nextNumberPadded}`;

        await query(`
            INSERT INTO transactions (
                id_transactions, user_id, total_price, payment_amount, change_amount, payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [transactionId, user_id, total_price, payment_amount, change_amount, payment_method]);

        res.redirect(`/transactions?success=add&id=${transactionId}`);
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// GET: Form edit transaksi
// ========================
router.get('/:id_transactions/edit', async (req, res) => {
    const { id_transactions } = req.params;

    try {
        const { rows } = await query('SELECT * FROM transactions WHERE id_transactions = $1', [id_transactions]);

        if (rows.length === 0) return res.status(404).send('Transaction not found');

        const transaction = rows[0];
        transaction.created_at = moment(transaction.created_at).format('YYYY-MM-DD HH:mm');

        const { rows: users } = await query('SELECT id_users, name FROM users_pos');

        res.render('transaction_form', {
            transaction,
            users,
            action: `/transactions/${id_transactions}?_method=PUT`,
            method: 'POST',
            errors: []
        });
    } catch (error) {
        console.error('Error loading edit form:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// PUT: Update transaksi
// ========================
router.put('/:id_transactions', [
    body('user_id').notEmpty().withMessage('User is required'),
    body('total_price').isDecimal({ min: 0 }).withMessage('Total price must be a positive number'),
    body('payment_amount').isDecimal({ min: 0 }).withMessage('Payment amount must be a positive number'),
    body('payment_method').notEmpty().withMessage('Payment method is required'),
], async (req, res) => {
    const errors = validationResult(req);
    const { id_transactions } = req.params;
    const { user_id, total_price, payment_amount, payment_method } = req.body;

    if (!errors.isEmpty()) {
        const { rows: users } = await query('SELECT id_users, name FROM users_pos');
        return res.render('transaction_form', {
            transaction: { ...req.body, id_transactions },
            users,
            action: `/transactions/${id_transactions}?_method=PUT`,
            method: 'POST',
            errors: errors.array()
        });
    }

    const change_amount = parseFloat(payment_amount) - parseFloat(total_price);

    try {
        const result = await query(`
            UPDATE transactions
            SET user_id = $1,
                total_price = $2,
                payment_amount = $3,
                change_amount = $4,
                payment_method = $5
            WHERE id_transactions = $6
        `, [user_id, total_price, payment_amount, change_amount, payment_method, id_transactions]);

        if (result.rowCount > 0) {
            res.redirect(`/transactions?success=edit&id=${id_transactions}`);
        } else {
            res.status(404).send('Transaction not found');
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).send('Internal Server Error');
    }
});

// DELETE: Hapus data dummy lama (total_price=0, status='unpaid', created_at sebelum hari ini)
router.delete('/delete-dummy', async (req, res) => {
  try {
    const { rowCount } = await query(`
      DELETE FROM transactions
      WHERE total_price = 0
        AND status = 'unpaid'
        AND created_at::date < CURRENT_DATE
    `);

    res.json({ deleted: rowCount });
  } catch (error) {
    console.error('Error deleting dummy transactions:', error);
    res.status(500).send('Server error saat menghapus data dummy');
  }
});

// ========================
// DELETE: Hapus transaksi
// ========================
router.delete('/:id_transactions', async (req, res) => {
    const { id_transactions } = req.params;

    try {
        const result = await query('DELETE FROM transactions WHERE id_transactions = $1', [id_transactions]);

        if (result.rowCount > 0) {
            res.redirect(`/transactions?success=delete&id=${id_transactions}`);
        } else {
            res.status(404).send('Transaction not found');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ========================
// GET: Export ke Excel
// ========================
router.get('/export/excel', async (req, res) => {
    try {
        const { rows: transactions } = await query(`
            SELECT 
                t.*, 
                u.name AS user_name
            FROM transactions t
            LEFT JOIN users_pos u ON t.user_id = u.id_users
            ORDER BY t.created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transactions');

        worksheet.columns = [
            { header: 'Transaction ID', key: 'id_transactions', width: 20 },
            { header: 'User', key: 'user_name', width: 25 },
            { header: 'Total Price', key: 'total_price', width: 15 },
            { header: 'Payment Amount', key: 'payment_amount', width: 15 },
            { header: 'Change Amount', key: 'change_amount', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Payment Method', key: 'payment_method', width: 15 },
            { header: 'Created At', key: 'created_at', width: 20 }
        ];

        transactions.forEach(tx => {
            worksheet.addRow({
                ...tx,
                created_at: moment(tx.created_at).format('YYYY-MM-DD HH:mm')
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Excel Export Error:', error);
        res.status(500).send('Failed to export Excel');
    }
});

// ========================
// GET: Export ke PDF
// ========================
router.get('/export/pdf', async (req, res) => {
    try {
        const { rows: transactions } = await query(`
            SELECT 
                t.*, 
                u.name AS user_name
            FROM transactions t
            LEFT JOIN users_pos u ON t.user_id = u.id_users
            ORDER BY t.created_at DESC
        `);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');

        doc.pipe(res);

        doc.fontSize(18).text('Transaction Report', { align: 'center' });
        doc.moveDown();

        transactions.forEach((t, i) => {
            doc.fontSize(12).text(`No: ${i + 1}`);
            doc.text(`ID: ${t.id_transactions}`);
            doc.text(`User: ${t.user_name || '-'}`);
            doc.text(`Total: Rp${t.total_price}`);
            doc.text(`Bayar: Rp${t.payment_amount}`);
            doc.text(`Kembali: Rp${t.change_amount}`);
            doc.text(`Status: ${t.status}`);
            doc.text(`Metode: ${t.payment_method}`);
            doc.text(`Waktu: ${moment(t.created_at).format('YYYY-MM-DD HH:mm')}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error('PDF Export Error:', error);
        res.status(500).send('Failed to export PDF');
    }
});

export default router;
