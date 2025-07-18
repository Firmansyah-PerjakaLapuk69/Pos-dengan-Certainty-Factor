import { Router } from 'express';
import { query } from '../config/db.js';
import moment from 'moment';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt'; 
import { ensureAuthenticated } from '../middleware/authMiddleware.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// Multer Setup for users_img
// ==============================
const userImgDir = path.join(__dirname, '..', 'public', 'img', 'userimg');
if (!fs.existsSync(userImgDir)) fs.mkdirSync(userImgDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, userImgDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const rawName = req.body.name || 'user';
        const cleanName = rawName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        const ext = path.extname(file.originalname);
        const filename = `${timestamp}_${cleanName}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage });

// ==============================
// GET: All Users
// ==============================
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { rows: users } = await query('SELECT * FROM users_pos ORDER BY created_at DESC');

    users.forEach(user => {
      if (user.created_at) {
        user.created_at = moment(user.created_at).utcOffset(7).format('YYYY-MM-DD HH:mm');
      }
    });

    // Ambil currentUser dari session (hasil login)
    const currentUser = req.session.user;

    res.render('users_pos', {
      users,
      currentUser
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ==============================
// GET: Add User Form
// ==============================
router.get('/new', (req, res) => {
    res.render('form_user', {
        user: {},
        action: '/users_pos',
        method: 'POST',
        errors: []
    });
});

// ==============================
// POST: Add User
// ==============================
router.post('/', upload.single('users_img'), [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['admin', 'cashier']).withMessage('Role must be admin or cashier')
], async (req, res) => {
    const errors = validationResult(req);
    const { name, email, password, role } = req.body;

    if (!errors.isEmpty()) {
        return res.render('form_user', {
            user: req.body,
            action: '/users_pos',
            method: 'POST',
            errors: errors.array()
        });
    }

    try {
        // Hash password sebelum simpan
        const hashedPassword = await bcrypt.hash(password, 10);

        // Buat ID user seperti kode kamu sebelumnya (tidak diubah)
        const date = new Date();
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        const prefix = `U${year}${month}${day}`;

        const { rows } = await query(
            `SELECT id_users FROM users_pos WHERE id_users LIKE '${prefix}%' ORDER BY id_users DESC LIMIT 1`
        );

        let sequence = 1;
        if (rows.length > 0) {
            const lastId = rows[0].id_users;
            const lastSeq = parseInt(lastId.slice(-4));
            sequence = lastSeq + 1;
        }

        const id_users = `${prefix}${String(sequence).padStart(4, '0')}`;
        let users_img = 'default.png';

        if (req.file) {
            users_img = `/img/userimg/${req.file.filename}`;
        }

        await query(
            `INSERT INTO users_pos (id_users, name, email, password, role, users_img)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_users, name, email, hashedPassword, role, users_img]
        );

        res.redirect(`/users_pos?success=add&id=${id_users}`);
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ==============================
// GET: Edit User Form
// ==============================
router.get('/:id_users/edit', async (req, res) => {
    const { id_users } = req.params;

    try {
        const { rows } = await query('SELECT * FROM users_pos WHERE id_users = $1', [id_users]);
        if (rows.length === 0) return res.status(404).send('User not found');

        res.render('form_user', {
            user: rows[0],
            action: `/users_pos/${id_users}?_method=PUT`,  // disesuaikan
            method: 'POST',
            errors: []
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ==============================
// PUT: Update User
// ==============================
router.put('/:id_users', upload.single('users_img'), async (req, res) => {
    const { id_users } = req.params;
    const { name, email, password, role } = req.body;

    try {
        // Ambil gambar lama dari database
        const { rows } = await query('SELECT users_img FROM users_pos WHERE id_users = $1', [id_users]);
        const oldImage = rows[0]?.users_img;

        let users_img = oldImage;

        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
            const newFilename = `${id_users}_${cleanName}${ext}`;
            const uploadPath = path.join(__dirname, '..', 'public', 'img', 'userimg');
            const newPath = path.join(uploadPath, newFilename);

            fs.renameSync(req.file.path, newPath);

            users_img = `/img/userimg/${newFilename}`;

            if (oldImage && oldImage !== 'default.png') {
                const oldPath = path.join(__dirname, '..', 'public', oldImage);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        // Jika password diisi, hash dulu, kalau kosong berarti gak diubah
        let hashedPassword;
        if (password && password.trim() !== '') {
            hashedPassword = await bcrypt.hash(password, 10);
        } else {
            // Ambil password lama dari database supaya gak terhapus
            const { rows: pwRows } = await query('SELECT password FROM users_pos WHERE id_users = $1', [id_users]);
            hashedPassword = pwRows[0]?.password;
        }

        await query(
            `UPDATE users_pos SET name = $1, email = $2, password = $3, role = $4, users_img = $5 WHERE id_users = $6`,
            [name, email, hashedPassword, role, users_img, id_users]
        );

        res.redirect(`/users_pos?success=edit&id=${id_users}`);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ==============================
// DELETE: Remove User
// ==============================
router.delete('/:id_users', async (req, res) => {
    const { id_users } = req.params;

    try {
        const { rows } = await query('SELECT users_img FROM users_pos WHERE id_users = $1', [id_users]);
        const imgPath = rows[0]?.users_img;

        if (imgPath && imgPath !== 'default.png') {
            const fullPath = path.join(__dirname, '..', 'public', imgPath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await query('DELETE FROM users_pos WHERE id_users = $1', [id_users]);

        res.redirect(`/users_pos?success=delete&id=${id_users}`);
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
