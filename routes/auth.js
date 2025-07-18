import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { query } from '../config/db.js';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// GET /login → Tampilkan form login
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  const errorMsg = req.query.error === 'please_login'
    ? 'Silakan login terlebih dahulu untuk mengakses halaman POS.'
    : null;

  res.render('login', { error: errorMsg, user: null });
});

// POST /login → Proses login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query('SELECT * FROM users_pos WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.render('login', { error: 'Email atau password salah', user: null });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.render('login', { error: 'Email atau password salah', user: null });
    }

    req.session.user = {
      id: user.id_users,
      name: user.name,
      email: user.email,
      role: user.role
    };
    console.log('User session set:', req.session.user);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', { error: 'Terjadi kesalahan sistem', user: null });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

// ======= Forgot Password & Reset Password =======

router.get('/forgot_password', (req, res) => {
  res.render('forgot_password', { error: null, success: null, user: null });
});

router.post('/forgot_password', async (req, res) => {
  const { email } = req.body;

  try {
    const result = await query('SELECT * FROM users_pos WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.render('forgot_password', {
        error: null,
        success: 'Jika email tersebut terdaftar, link reset password akan dikirim.',
        user: null
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date(Date.now() + 3600000);

    await query(
      'UPDATE users_pos SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3',
      [resetToken, expiryDate, email]
    );

    const resetLink = `${req.protocol}://${req.get('host')}/reset_password/${resetToken}`;

    const mailOptions = {
      from: '"Your App Name" <your.email@gmail.com>',
      to: user.email,
      subject: 'Reset Password',
      html: `
        <p>Anda meminta reset password. Klik link berikut untuk mengganti password Anda:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Link ini berlaku selama 1 jam.</p>
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Gagal kirim email reset password:', err);
        return res.render('forgot_password', {
          error: 'Gagal mengirim email reset password. Silakan coba lagi.',
          success: null,
          user: null
        });
      }

      res.render('forgot_password', {
        error: null,
        success: 'Link reset password telah dikirim ke email Anda.',
        user: null
      });
    });
  } catch (err) {
    console.error('Error forgot password:', err);
    res.status(500).render('forgot_password', {
      error: 'Terjadi kesalahan sistem',
      success: null,
      user: null
    });
  }
});

router.get('/reset_password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await query(
      'SELECT * FROM users_pos WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    const user = result.rows[0];

    if (!user) {
      return res.render('reset_password', {
        error: 'Token reset password tidak valid atau sudah kedaluwarsa.',
        token: null,
        user: null
      });
    }

    res.render('reset_password', { error: null, token, user: null });
  } catch (err) {
    console.error('Error get reset password:', err);
    res.status(500).render('reset_password', {
      error: 'Terjadi kesalahan sistem',
      token: null,
      user: null
    });
  }
});

router.post('/reset_password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, password_confirm } = req.body;

  if (!password || !password_confirm || password !== password_confirm) {
    return res.render('reset_password', {
      error: 'Password dan konfirmasi harus sama',
      token,
      user: null
    });
  }

  try {
    const result = await query(
      'SELECT * FROM users_pos WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    const user = result.rows[0];

    if (!user) {
      return res.render('reset_password', {
        error: 'Token reset password tidak valid atau sudah kedaluwarsa.',
        token: null,
        user: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query(
      'UPDATE users_pos SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id_users = $2',
      [hashedPassword, user.id_users]
    );

    res.redirect('/login?reset=success');
  } catch (err) {
    console.error('Error reset password:', err);
    res.status(500).render('reset_password', {
      error: 'Terjadi kesalahan sistem',
      token,
      user: null
    });
  }
});

// Contoh route dashboard (optional)
router.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

export default router;
