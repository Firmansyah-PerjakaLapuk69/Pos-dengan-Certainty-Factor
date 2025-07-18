import { Router } from 'express';
import { query } from '../config/db.js';
import moment from 'moment';

const router = Router();

// Render halaman dashboard utama
router.get('/', (req, res) => {
  res.render('dashboard');
});

// GET /dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const sql = `
      WITH
        current_month_transactions AS (
          SELECT * FROM transactions
          WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND created_at < date_trunc('month', CURRENT_DATE + interval '1 month')
        ),
        current_month_batches AS (
          SELECT * FROM product_batches
          WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND created_at < date_trunc('month', CURRENT_DATE + interval '1 month')
        ),
        current_year_transactions AS (
          SELECT * FROM transactions
          WHERE created_at >= date_trunc('year', CURRENT_DATE)
            AND created_at < date_trunc('year', CURRENT_DATE + interval '1 year')
        ),
        current_year_batches AS (
          SELECT * FROM product_batches
          WHERE created_at >= date_trunc('year', CURRENT_DATE)
            AND created_at < date_trunc('year', CURRENT_DATE + interval '1 year')
        )

      SELECT
        'bulan' AS periode,
        COUNT(DISTINCT t.id_transactions) AS total_transactions,
        COALESCE(SUM(ti.subtotal), 0) AS total_revenue,
        COALESCE(SUM(ti.quantity), 0) AS total_items_sold,
        CASE 
            WHEN COUNT(DISTINCT t.id_transactions) = 0 THEN 0 
            ELSE ROUND(SUM(ti.subtotal) / COUNT(DISTINCT t.id_transactions), 2) 
        END AS avg_transaction_value,
        COALESCE((SELECT SUM(p.purchase_price * p.stock) FROM current_month_batches p), 0) AS total_modal,
        COALESCE((SELECT SUM(t.total_price) FROM current_month_transactions t), 0) 
          - COALESCE((SELECT SUM(p.purchase_price * p.stock) FROM current_month_batches p), 0) AS total_profit
      FROM current_month_transactions t
      LEFT JOIN transaction_items ti ON t.id_transactions = ti.id_transactions

      UNION ALL

      SELECT
        'tahun' AS periode,
        COUNT(DISTINCT t.id_transactions) AS total_transactions,
        COALESCE(SUM(ti.subtotal), 0) AS total_revenue,
        COALESCE(SUM(ti.quantity), 0) AS total_items_sold,
        CASE 
            WHEN COUNT(DISTINCT t.id_transactions) = 0 THEN 0 
            ELSE ROUND(SUM(ti.subtotal) / COUNT(DISTINCT t.id_transactions), 2) 
        END AS avg_transaction_value,
        COALESCE((SELECT SUM(p.purchase_price * p.stock) FROM current_year_batches p), 0) AS total_modal,
        COALESCE((SELECT SUM(t.total_price) FROM current_year_transactions t), 0) 
          - COALESCE((SELECT SUM(p.purchase_price * p.stock) FROM current_year_batches p), 0) AS total_profit
      FROM current_year_transactions t
      LEFT JOIN transaction_items ti ON t.id_transactions = ti.id_transactions;
    `;

    const { rows } = await query(sql);
    res.json(rows); // Kirim array, berisi 2 objek (bulan & tahun)
  } catch (error) {
    console.error('Error retrieving summary:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2a. GET /dashboard/sales-month
router.get('/sales-month', async (req, res) => {
  try {
    const sql = `
      SELECT
        t.created_at::date AS date,
        COALESCE(SUM(t.total_price), 0) AS total_revenue
      FROM transactions t
      WHERE date_trunc('month', t.created_at) = date_trunc('month', CURRENT_DATE)
      GROUP BY t.created_at::date
      ORDER BY date;
    `;
    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving monthly sales:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2b. GET /dashboard/sales-year
router.get('/sales-year', async (req, res) => {
  try {
    const sql = `
      SELECT
        date_trunc('month', t.created_at)::date AS month,
        COALESCE(SUM(t.total_price), 0) AS total_revenue
      FROM transactions t
      WHERE date_trunc('year', t.created_at) = date_trunc('year', CURRENT_DATE)
      GROUP BY month
      ORDER BY month;
    `;
    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving yearly sales:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /dashboard/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const sql = `
      SELECT
        p.id_products,
        p.name,
        SUM(pb.stock) AS total_stock
      FROM products p
      JOIN product_batches pb ON p.id_products = pb.product_id
      GROUP BY p.id_products, p.name
      HAVING SUM(pb.stock) <= 50
      ORDER BY total_stock ASC;
    `;
    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving low stock products:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
});
// 4. GET /dashboard/expiring
router.get('/expiring', async (req, res) => {
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        pb.batch_number,
        pb.expiry_date,
        pb.stock,
        CASE 
          WHEN pb.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN pb.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 months') THEN 'expiring_soon'
          ELSE 'safe'
        END AS status
      FROM product_batches pb
      JOIN products p ON pb.product_id = p.id_products
      WHERE pb.expiry_date <= (CURRENT_DATE + INTERVAL '6 months')
        AND pb.stock > 0
      ORDER BY pb.expiry_date ASC;
    `;
    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving expiring batches:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET /dashboard/recent
router.get('/recent', async (req, res) => {
  try {
    const sql = `
      SELECT
        t.id_transactions,
        u.name AS cashier_name,
        t.total_price,
        t.status,
        t.created_at
      FROM transactions t
      JOIN users_pos u ON t.user_id = u.id_users
      ORDER BY t.created_at DESC
      LIMIT 10;
    `;
    const { rows } = await query(sql);
    const formatted = rows.map(t => ({
      ...t,
      created_at: moment(t.created_at).format('YYYY-MM-DD HH:mm')
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error retrieving recent transactions:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
});

// 6. GET /dashboard/top-products
router.get('/top-products', async (req, res) => {
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        SUM(ti.quantity) AS total_sold
      FROM transaction_items ti
      JOIN products p ON ti.id_products = p.id_products
      JOIN transactions t ON ti.id_transactions = t.id_transactions
      WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY p.id_products, p.name
      ORDER BY total_sold DESC
      LIMIT 5;
    `;
    const { rows } = await query(sql);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No product sales found.' });
    }

    res.json(rows);
  } catch (error) {
    console.error('Error retrieving top products:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Rekomendasi Pakar
router.get('/expert-recommendation', async (req, res) => {
  try {
    const sql = `
      WITH product_stats AS (
        SELECT
          p.id_products,
          p.name AS product_name,
          COALESCE(SUM(ti.quantity) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) AS total_sold,
          COALESCE(SUM(pb.stock), 0) AS total_stock,
          ROUND(AVG(pb.selling_price)) AS selling_price,
          ROUND(AVG(pb.purchase_price)) AS purchase_price
        FROM products p
        LEFT JOIN transaction_items ti ON p.id_products = ti.id_products
        LEFT JOIN transactions t ON ti.id_transactions = t.id_transactions
        LEFT JOIN product_batches pb ON p.id_products = pb.product_id
        GROUP BY p.id_products, p.name
      )
      SELECT
        ps.*,
        er.recommendation,
        er.certainty_factor,
        er.rule_name,
        CASE 
          WHEN er.recommendation ILIKE '%diskon%' THEN 
            FLOOR(
              LEAST(
                ps.total_stock,
                GREATEST(
                  0,
                  FLOOR((ps.selling_price * 0.8 - ps.purchase_price) * ps.total_stock / (ps.purchase_price * 0.1))
                )
              )
            )
          ELSE NULL
        END AS discount_units,
        CASE 
          WHEN er.recommendation ILIKE '%diskon%' THEN 
            ((ps.selling_price * 0.8 - ps.purchase_price) * 
            FLOOR(
              LEAST(
                ps.total_stock,
                GREATEST(
                  0,
                  FLOOR((ps.selling_price * 0.8 - ps.purchase_price) * ps.total_stock / (ps.purchase_price * 0.1))
                )
              )
            ))
          ELSE NULL
        END AS estimated_profit
      FROM product_stats ps
      JOIN expert_rules er
        ON ps.total_sold BETWEEN er.condition_sold_min AND er.condition_sold_max
       AND ps.total_stock BETWEEN er.condition_stock_min AND er.condition_stock_max
      WHERE er.certainty_factor >= 0.5
      ORDER BY er.certainty_factor DESC;
    `;

    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error evaluating expert rules:', error.message);
    res.status(500).json({ error: 'Gagal memproses rekomendasi pakar' });
  }
});

// Tambahkan di bawah route lain di dashboard.js
router.get('/safe-discount', async (req, res) => {
  try {
    const sql = `
      WITH product_stats AS (
        SELECT
          p.id_products,
          p.name AS product_name,
          COALESCE(SUM(ti.quantity) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) AS total_sold,
          COALESCE(SUM(pb.stock), 0) AS total_stock,
          ROUND(AVG(pb.selling_price)) AS selling_price,
          ROUND(AVG(pb.purchase_price)) AS purchase_price
        FROM products p
        LEFT JOIN transaction_items ti ON p.id_products = ti.id_products
        LEFT JOIN transactions t ON ti.id_transactions = t.id_transactions
        LEFT JOIN product_batches pb ON p.id_products = pb.product_id
        GROUP BY p.id_products, p.name
      ),
      diskon_calc AS (
        SELECT 
          ps.*,
          er.recommendation,
          er.certainty_factor,
          er.rule_name,

          -- Harga diskon dan margin per unit
          (ps.selling_price * 0.8)::int AS discounted_price,
          (ps.selling_price * 0.8 - ps.purchase_price)::int AS unit_margin,

          -- Hitung unit diskon
          CASE 
            WHEN er.recommendation ILIKE '%diskon%' THEN 
              FLOOR(
                LEAST(
                  ps.total_stock,
                  GREATEST(
                    0,
                    FLOOR((ps.selling_price * 0.8 - ps.purchase_price) * ps.total_stock / (ps.purchase_price * 0.1))
                  )
                )
              )
            ELSE NULL
          END AS discount_units,

          -- Estimasi profit
          CASE 
            WHEN er.recommendation ILIKE '%diskon%' THEN 
              ((ps.selling_price * 0.8 - ps.purchase_price) * 
              FLOOR(
                LEAST(
                  ps.total_stock,
                  GREATEST(
                    0,
                    FLOOR((ps.selling_price * 0.8 - ps.purchase_price) * ps.total_stock / (ps.purchase_price * 0.1))
                  )
                )
              ))::int
            ELSE NULL
          END AS estimated_profit,

          -- Omzet diskon
          CASE 
            WHEN er.recommendation ILIKE '%diskon%' THEN 
              ((ps.selling_price * 0.8) * 
              FLOOR(
                LEAST(
                  ps.total_stock,
                  GREATEST(
                    0,
                    FLOOR((ps.selling_price * 0.8 - ps.purchase_price) * ps.total_stock / (ps.purchase_price * 0.1))
                  )
                )
              ))::int
            ELSE NULL
          END AS estimated_revenue

        FROM product_stats ps
        JOIN expert_rules er
          ON ps.total_sold BETWEEN er.condition_sold_min AND er.condition_sold_max
         AND ps.total_stock BETWEEN er.condition_stock_min AND er.condition_stock_max
        WHERE er.certainty_factor >= 0.5
      )

      SELECT *,
        CASE 
          WHEN discounted_price > purchase_price THEN 'Aman'
          ELSE 'Berbahaya'
        END AS status
      FROM diskon_calc
      WHERE discount_units > 0
      ORDER BY estimated_profit DESC;
    `;

    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching safe discount data:', error.message);
    res.status(500).json({ error: 'Gagal memuat data diskon aman' });
  }
});

export default router;