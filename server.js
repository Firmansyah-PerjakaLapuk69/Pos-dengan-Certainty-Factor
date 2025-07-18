import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session'; // ✅ Tambahan untuk session
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRouter from './routes/auth.js'; // ✅ Tambahan untuk login
import dashboardRouter from './routes/dashboard.js';
import categoriesRouter from './routes/categories.js';
import productbatchesRouter from './routes/product_batches.js';
import productsRouter from './routes/products.js';
import transactionItemsRouter from './routes/transaction_items.js';
import transactionsRouter from './routes/transactions.js';
import unitsRouter from './routes/units.js';
import usersposRouter from './routes/users_pos.js';

// Import auth middleware
import { ensureAuthenticated } from './middleware/authMiddleware.js'; // ✅ Tambahan

const app = express();
const PORT = process.env.PORT || 3002;

// Mengambil path direktori untuk digunakan dalam Express
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware untuk parsing JSON dan form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware untuk session
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));
// Menggunakan methodOverride agar form dapat mengirim PUT dan DELETE
app.use(methodOverride('_method'));

// Menyediakan folder static untuk file CSS, JS, gambar, dll
app.use(express.static(path.join(__dirname, 'public')));

// Menyeting EJS sebagai template engine dan menentukan direktori views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Fungsi formatRupiah ---
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2
  }).format(amount);
}

// --- Middleware untuk menambahkan formatRupiah dan user ke locals ---
// Ini yang diupdate supaya user tidak undefined di EJS
app.use((req, res, next) => {
  res.locals.formatRupiah = formatRupiah;
  res.locals.user = req.session?.user || null; // atau default object kalau mau
  next();
});

// --- Routes ---
// Auth routes (tidak perlu login)
app.use('/', authRouter); // ✅ Login dan Logout

// Routes yang memerlukan login
app.use('/dashboard', ensureAuthenticated, dashboardRouter);
app.use('/categories', ensureAuthenticated, categoriesRouter);
app.use('/product_batches', ensureAuthenticated, productbatchesRouter);
app.use('/products', ensureAuthenticated, productsRouter);
app.use('/transactions', ensureAuthenticated, transactionsRouter);
app.use('/transaction_items', ensureAuthenticated, transactionItemsRouter);
app.use('/units', ensureAuthenticated, unitsRouter);
app.use('/users_pos', ensureAuthenticated, usersposRouter);

// Handler untuk route yang tidak ditemukan
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error encountered:', err.message);
  console.error('Stack trace:', err.stack);
  res.status(500).send('Internal Server Error');
});

// Menjalankan server di port yang sudah ditentukan
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
