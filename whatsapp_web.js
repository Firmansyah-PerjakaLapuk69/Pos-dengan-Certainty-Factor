import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import moment from 'moment';
import { query } from './config/db.js'; // Pastikan path benar

const { Client, LocalAuth } = pkg;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const conversationContext = {};
const userBNumber = '18002428478@c.us';
const allowedGroupId = [
    '120363149122566543@g.us'
    //,'120363098311376951@g.us'
];

// 🔐 Tampilkan QR code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// ✅ Saat client siap
client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');
    const chats = await client.getChats();
    console.log('\n📋 Grup yang Terdeteksi:');
    chats.filter(chat => chat.isGroup).forEach(chat => {
        console.log(`- ${chat.name} => ${chat.id._serialized}`);
    });
});

function formatPhoneNumberToWhatsApp(phone) {
    // Hanya ubah jika input angka biasa seperti 08xxx
    if (phone.startsWith('0')) {
        return '62' + phone.slice(1) + '@c.us';
    } else if (phone.startsWith('62')) {
        return phone + '@c.us';
    } else if (phone.endsWith('@c.us') || phone.endsWith('@g.us')) {
        return phone; // Sudah dalam format WhatsApp
    }
    throw new Error('Nomor WhatsApp tidak valid: ' + phone);
}

// Set untuk menyimpan user yang sudah diberi peringatan di grup
const warnedUsersGroup = new Set();
// Set untuk menyimpan user yang sudah diberi peringatan di chat pribadi
const warnedUsersPrivate = new Set();

// 🟢 Handler pesan masuk
client.on('message', async msg => {
    const chat = await msg.getChat();
    const originalCommand = msg.body.trim(); // Simpan command asli untuk log/debug
    const command = originalCommand.toLowerCase(); // Normalize

    const isCommand = [
        '/product_batches',
        '/product_batches low_stock',
        '/product_batches high_stock'
    ].includes(command);

    console.log(`📩 Pesan dari ${msg.from} di ${chat.isGroup ? 'grup' : 'pribadi'} ${chat.name || chat.id.user}: ${originalCommand}`);

    // Abaikan pesan dari userB (Perjaka)
    if (msg.from === userBNumber) {
        console.log('📩 Pesan dari Perjaka diabaikan.');
        return;
    }

    // 🔄 Handle /askperjaka (dalam berbagai format huruf)
    if (command.startsWith('/askperjaka')) {
        const question = originalCommand.substring(originalCommand.indexOf(' ')).trim();

        if (!chat.isGroup || allowedGroupId.includes(chat.id._serialized)) {
            conversationContext[userBNumber] = {
                from: msg.from,
                question: question
            };

            const userBChat = await client.getChatById(userBNumber);
            await userBChat.sendMessage(question);
            await msg.reply('📤 Pertanyaanmu telah dikirim. Tunggu jawabannya...');
            console.log(`🔁 Pertanyaan dikirim dari ${msg.from} ke ${userBNumber}`);

            warnedUsersGroup.delete(msg.from);
            warnedUsersPrivate.delete(msg.from);
        }

        return;
    }

    // 🔸 Chat Pribadi
    if (!chat.isGroup) {
        if (isCommand) {
            if (command === '/product_batches') {
                await sendBatches(chat, 'latest');
            } else if (command === '/product_batches low_stock') {
                await sendBatches(chat, 'low');
            } else if (command === '/product_batches high_stock') {
                await sendBatches(chat, 'high');
            }
            warnedUsersPrivate.delete(msg.from);
        } else {
             // Tidak melakukan apa-apa jika bukan command yang dikenali
            console.log(`ℹ️ Pesan diabaikan dari ${chat.id.user}: ${originalCommand}`);
        }
        return;
    }

    // 🔸 Chat Grup
    if (!allowedGroupId.includes(chat.id._serialized)) {
        console.log(`⚠️ Grup tidak diizinkan: ${chat.id._serialized}`);
        return;
    }

    if (isCommand) {
        if (command === '/product_batches') {
            await sendBatches(chat, 'latest');
        } else if (command === '/product_batches low_stock') {
            await sendBatches(chat, 'low');
        } else if (command === '/product_batches high_stock') {
            await sendBatches(chat, 'high');
        }
        warnedUsersGroup.delete(msg.from);
    } else {
        // Tidak membalas pesan non-command di grup
        console.log(`ℹ️ Pesan non-command di grup diabaikan dari ${msg.from}: ${originalCommand}`);
    }
});

// 🔁 Handle balasan dari userB (perjaka)
client.on('message', async response => {
    if (response.from === userBNumber) {
        const context = conversationContext[userBNumber];
        if (context) {
            const userAChat = await client.getChatById(context.from);
            await userAChat.sendMessage(`📨 *Balasan dari Perjaka:*\n${response.body}`);
            delete conversationContext[userBNumber];
            console.log(`✅ Balasan dari ${userBNumber} dikirim ke ${context.from}`);
        }
    }
});

// 📦 Fungsi untuk mengirim data produk batch
async function sendBatches(chat, mode = 'latest') {
    try {
        let sql = '';
        let title = '';

        if (mode === 'low') {
            sql = `
                SELECT pb.batch_number, pb.stock, pb.expiry_date, p.name AS product_name
                FROM product_batches pb
                JOIN products p ON pb.product_id = p.id_products
                ORDER BY pb.stock ASC
                LIMIT 10
            `;
            title = '📉 *10 Batch dengan Stok Terendah:*';
        } else if (mode === 'high') {
            sql = `
                SELECT pb.batch_number, pb.stock, pb.expiry_date, p.name AS product_name
                FROM product_batches pb
                JOIN products p ON pb.product_id = p.id_products
                ORDER BY pb.stock DESC
                LIMIT 10
            `;
            title = '📦 *10 Batch dengan Stok Tertinggi:*';
        } else {
            sql = `
                SELECT pb.batch_number, pb.stock, pb.expiry_date, p.name AS product_name
                FROM product_batches pb
                JOIN products p ON pb.product_id = p.id_products
                ORDER BY pb.created_at DESC
                LIMIT 10
            `;
            title = '📋 *10 Product Batches Terbaru:*';
        }

        const { rows } = await query(sql);

        if (rows.length === 0) {
            await client.sendMessage(chat.id._serialized, '❌ Tidak ada data ditemukan.');
            return;
        }

        let message = `${title}\n\n`;
        rows.forEach(row => {
            message += `🆔 *${row.batch_number}* (${row.product_name})\n📦 Stock: ${row.stock}\n📅 Exp: ${moment(row.expiry_date).format('YYYY-MM-DD')} (${getExpiryLabel(row.expiry_date)})\n\n`;
        });

        await client.sendMessage(chat.id._serialized, message);
        console.log(`✅ Data batch dikirim ke ${chat.isGroup ? 'grup' : 'pribadi'}: ${chat.name || chat.id.user}`);
    } catch (err) {
        console.error('❌ Gagal mengambil data batch:', err);
        await client.sendMessage(chat.id._serialized, '❌ Gagal mengambil data dari server.');
    }
}

// ⏳ Fungsi bantu label kadaluarsa
function getExpiryLabel(expiryDate) {
    const now = moment();
    const expiry = moment(expiryDate);

    if (expiry.isBefore(now, 'day')) return '✅ Kadaluarsa';

    const yearDiff = expiry.year() - now.year();
    const monthDiff = expiry.month() - now.month();
    let totalMonths = yearDiff * 12 + monthDiff;

    if (expiry.date() < now.date()) totalMonths -= 1;

    return `${totalMonths} bulan lagi`;
}

// 📤 Fungsi global untuk kirim notifikasi
export async function sendWhatsAppNotification(message, to = null) {
    try {
        const targets = to ? [formatPhoneNumberToWhatsApp(to), ...allowedGroupId] : allowedGroupId;
        for (const id of targets) {
            await client.sendMessage(id, message);
            console.log(`✅ Pesan WhatsApp terkirim ke ${id}`);
        }
    } catch (error) {
        console.error('❌ Gagal mengirim WhatsApp:', error.message);
    }
}

// 🚀 Mulai client
client.initialize();
