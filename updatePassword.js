// updatePassword.js
import bcrypt from 'bcrypt';
import { query } from './config/db.js'; // sesuaikan path kalau perlu

async function hashPasswordAndUpdate(email, plainPassword) {
  const hashed = await bcrypt.hash(plainPassword, 10);
  await query('UPDATE users_pos SET password = $1 WHERE email = $2', [hashed, email]);
  console.log(`Password for ${email} updated to hashed version.`);
}

// Panggil fungsi untuk update password tertentu
hashPasswordAndUpdate('admin1@mail.com', 'pass1')
  .then(() => {
    console.log('Update selesai');
    process.exit();
  })
  .catch((err) => {
    console.error('Error saat update password:', err);
    process.exit(1);
  });
