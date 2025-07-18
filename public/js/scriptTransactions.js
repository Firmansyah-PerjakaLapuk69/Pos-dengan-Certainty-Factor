// Fungsi format Rupiah
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2
    }).format(amount);
}

// Fungsi untuk parsing string angka, menghilangkan karakter non angka dan titik
function parseNumber(value) {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    return parseFloat(cleanValue) || 0;
}

// Sidebar toggle function for transactions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');

    sidebar.classList.toggle('open');

    if (sidebar.classList.contains('open')) {
        content.style.marginLeft = '0';
    } else {
        content.style.marginLeft = '250px';
    }
}

// Function to toggle dark mode
function toggleDarkMode() {
    const body = document.body;
    const darkModeButton = document.querySelector('.btn-outline-secondary');

    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        darkModeButton.innerHTML = '<i class="fa fa-sun"></i>';
    } else {
        localStorage.setItem('theme', 'light');
        darkModeButton.innerHTML = '<i class="fa fa-moon"></i>';
    }
}

// Load saved theme from localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
} else {
    document.body.classList.remove('dark-mode');
}

// Function to search transactions
function searchTransactions() {
    const query = document.getElementById('transactionSearchInput')?.value?.toLowerCase() || '';
    const rows = document.querySelectorAll('.transaction-row');

    rows.forEach(row => {
        const id = row.children[0]?.textContent.toLowerCase();
        const user = row.children[1]?.textContent.toLowerCase();
        const status = row.children[5]?.textContent.toLowerCase();

        const match = [id, user, status].some(field => field.includes(query));
        row.style.display = match ? '' : 'none';
    });
}

// === FORM ADD TRANSACTION ===
function calculateChangeAmount() {
    const totalPriceRaw = document.getElementById('total_price').value || '0';
    const paymentAmountRaw = document.getElementById('payment_amount').value || '0';

    const totalPrice = parseNumber(totalPriceRaw);
    const paymentAmount = parseNumber(paymentAmountRaw);
    const changeAmount = paymentAmount - totalPrice;

    if (changeAmount < 0) {
        document.getElementById('change_amount').value = formatRupiah(0);
        document.getElementById('status').value = 'failed';
    } else {
        document.getElementById('change_amount').value = formatRupiah(changeAmount);
        document.getElementById('status').value = 'paid';
    }
}

// === FORM EDIT TRANSACTION ===
function calculateEditChangeAmount() {
    const totalPriceRaw = document.getElementById('editTotalPrice').value || '0';
    const paymentAmountRaw = document.getElementById('editPaymentAmount').value || '0';

    const totalPrice = parseNumber(totalPriceRaw);
    const paymentAmount = parseNumber(paymentAmountRaw);
    const changeAmount = paymentAmount - totalPrice;

    const changeField = document.getElementById('editChangeAmount');
    const statusField = document.getElementById('editStatus');
    const submitBtn = document.querySelector('#editTransactionForm button[type="submit"]');

    if (changeAmount < 0) {
        changeField.value = formatRupiah(0);
        statusField.value = 'failed';
        submitBtn.disabled = true;
    } else {
        changeField.value = formatRupiah(changeAmount);
        statusField.value = 'paid';
        submitBtn.disabled = false;
    }
}

// Set delete action
function setDeleteAction(actionUrl, transactionId) {
    const form = document.getElementById('deleteTransactionForm');
    form.action = actionUrl;

    const modalDescription = document.getElementById('deleteTransactionModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete the transaction with ID <strong>${transactionId}</strong>? This action cannot be undone.</p>`;
}

// Edit transaction modal
function editTransaction(buttonElement) {
    const transaction = JSON.parse(buttonElement.getAttribute('data-transaction'));

    const form = document.getElementById('editTransactionForm');
    form.action = `/transactions/${transaction.id_transactions}?_method=PUT`;

    document.getElementById('editTransactionId').value = transaction.id_transactions;
    document.getElementById('editTotalPrice').value = transaction.total_price;
    document.getElementById('editPaymentAmount').value = transaction.payment_amount;
    document.getElementById('editPaymentMethod').value = transaction.payment_method;

    // Set user and ensure correct option is selected
    const userSelect = document.getElementById('editUserId');
    userSelect.value = transaction.user_id.toString();
    for (let option of userSelect.options) {
        option.selected = option.value === transaction.user_id.toString();
    }

    // Recalculate and fill change amount and status
    calculateEditChangeAmount();

    // Open modal
    const editModal = new bootstrap.Modal(document.getElementById('editTransactionModal'));
    editModal.show();
}

// Pagination
let transactionsPerPage;
let currentPage;
let transactions;
let totalTransactions;

const displayTransactions = (page) => {
    const start = (page - 1) * transactionsPerPage;
    const end = start + transactionsPerPage;

    transactions.forEach((transaction, index) => {
        transaction.style.display = (index >= start && index < end) ? '' : 'none';
    });

    updatePaginationButtons(page);
};

const updatePaginationButtons = (page) => {
    const paginationElement = document.getElementById('pagination');
    const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

    const previousButton = document.getElementById('previousPage');
    const nextButton = document.getElementById('nextPage');

    previousButton.classList.toggle('disabled', page === 1);
    nextButton.classList.toggle('disabled', page === totalPages);

    paginationElement.innerHTML = '';
    paginationElement.appendChild(previousButton);

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === page ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            displayTransactions(currentPage);
        });
        paginationElement.appendChild(li);
    }

    paginationElement.appendChild(nextButton);
};

window.updateLimit = () => {
    transactionsPerPage = parseInt(document.getElementById('limitSelect').value);
    currentPage = 1;
    displayTransactions(currentPage);
};

document.addEventListener('DOMContentLoaded', () => {
    transactionsPerPage = parseInt(document.getElementById('limitSelect').value);
    currentPage = 1;

    transactions = Array.from(document.querySelectorAll('#transactionList tr'));
    totalTransactions = transactions.length;

    displayTransactions(currentPage);
    updatePaginationButtons(currentPage);

    // Event listeners for add transaction form inputs
    const addForm = document.querySelector('#addTransactionModal form');
    if (addForm) {
        const totalPriceInput = document.getElementById('total_price');
        const paymentAmountInput = document.getElementById('payment_amount');

        totalPriceInput.addEventListener('input', calculateChangeAmount);
        paymentAmountInput.addEventListener('input', calculateChangeAmount);

        addForm.addEventListener('submit', function (e) {
            const totalPrice = parseNumber(totalPriceInput.value);
            const paymentAmount = parseNumber(paymentAmountInput.value);

            if (paymentAmount < totalPrice) {
                e.preventDefault();
                alert('Payment amount is less than total price. Please enter a sufficient amount.');
            }
        });
    }

    // Event listeners for edit transaction form inputs
    const editTotalPrice = document.getElementById('editTotalPrice');
    const editPaymentAmount = document.getElementById('editPaymentAmount');
    if (editTotalPrice && editPaymentAmount) {
        editTotalPrice.addEventListener('input', calculateEditChangeAmount);
        editPaymentAmount.addEventListener('input', calculateEditChangeAmount);
    }

    // Load saved theme from localStorage (repeat to ensure proper state after DOM ready)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    // Toast notification based on URL params
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('success');
    const id = urlParams.get('id');

    if (action === 'add') {
        showToast(`Transaction ${id} successfully added`, 'success');
    } else if (action === 'edit') {
        showToast(`Transaction ${id} successfully updated`, 'warning');
    } else if (action === 'delete') {
        showToast(`Transaction ${id} successfully deleted`, 'danger');
    }
});

// Toast
function showToast(message, type = 'success') {
    const toastElement = document.getElementById('actionToast');
    const toastMessage = document.getElementById('toastMessage');

    toastElement.className = `toast align-items-center text-bg-${type} border-0`;
    toastMessage.textContent = message;

    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    toast.show();
}

document.getElementById('generateButton').addEventListener('click', async () => {
    const countInput = document.getElementById('generateCount');
    const count = parseInt(countInput.value);

    if (!count || count < 1) {
        alert('Masukkan jumlah transaksi yang valid (minimal 1)');
        return;
    }

    try {
        const response = await fetch('/transactions/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count })
        });

        if (!response.ok) {
            throw new Error('Gagal generate transaksi');
        }

        const data = await response.json();

        // Tampilkan toast / alert sukses
        showToast(`${data.generated} transaksi berhasil dibuat.`);

        // Clear input setelah sukses
        countInput.value = '';

        // Reload halaman atau update daftar transaksi kalau perlu
        setTimeout(() => {
            location.reload();
        }, 1500);

    } catch (error) {
        alert('Terjadi kesalahan: ' + error.message);
    }
});

document.getElementById('deleteDummyButton').addEventListener('click', async () => {
    if (!confirm('Apakah kamu yakin ingin menghapus semua data dummy lama? Data ini tidak dapat dikembalikan.')) {
        return;
    }

    try {
        const response = await fetch('/transactions/delete-dummy', {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Status: ${response.status}, Message: ${errorText}`);
        }

        const data = await response.json();

        showToast(`${data.deleted} transaksi dummy berhasil dihapus.`);

        setTimeout(() => {
            location.reload();
        }, 1500);
    } catch (error) {
        alert('Terjadi kesalahan: ' + error.message);
    }
});

// Fungsi untuk menampilkan toast
function showToast(message) {
    const toastEl = document.getElementById('actionToast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

