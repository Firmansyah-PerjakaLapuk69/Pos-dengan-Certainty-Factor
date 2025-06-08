// Sidebar toggle function
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
    const darkModeButton = document.querySelector('.btn-outline-secondary');  // The button for dark mode
    
    body.classList.toggle('dark-mode');
    
    // Update button text/icon
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        darkModeButton.innerHTML = '<i class="fa fa-sun"></i>';  // Change to sun icon when dark mode is active
    } else {
        localStorage.setItem('theme', 'light');
        darkModeButton.innerHTML = '<i class="fa fa-moon"></i>';  // Change back to moon icon
    }
}

// Load saved theme from localStorage when the page loads
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
} else if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
}

// JavaScript for searching patient insurance records based on patient name, insurance company, and policy number
function searchTransactionItems() {
    const query = document.getElementById('transactionSearchInput').value.toLowerCase();
    const transactionRows = document.querySelectorAll('.transaction-row');

    transactionRows.forEach(row => {
        const idTransactions = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const productName = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const batchNumber = row.querySelector('td:nth-child(3)').textContent.toLowerCase();

        const isMatch =
            idTransactions.includes(query) ||
            productName.includes(query) ||
            batchNumber.includes(query);

        row.style.display = isMatch ? '' : 'none';
    });
}

// Set delete action for the modal
function setDeleteAction(actionUrl, recordId) {
    const form = document.getElementById('deleteInsuranceForm');
    form.action = actionUrl;  // Set the form action URL to the delete URL

    const modalDescription = document.getElementById('deleteInsuranceModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete the patient insurance record for Patient ID <strong>${recordId}</strong>? This action cannot be undone.</p>`;
}

function editInsuranceRecord(buttonElement) {
    const insurance = JSON.parse(buttonElement.getAttribute('data-record'));  // Ambil data dari atribut

    if (!insurance || !insurance.patient_id) {
        console.error('Missing patient_id');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('editInsuranceModal'));

    // ✅ Perbaikan: Gunakan string, bukan regex
    document.getElementById('editInsuranceForm').action = `/patient_insurance/${insurance.patient_id}?_method=PUT`;

    // Isi semua input di modal dengan data
    document.getElementById('editPatient').value = insurance.patient_id;
    document.getElementById('editInsurance').value = insurance.insurance_id;
    document.getElementById('editPolicyNumber').value = insurance.policy_number;
    document.getElementById('editCoverageDetails').value = insurance.coverage_details;

    // ✅ Perbaikan: Format tanggal agar cocok dengan <input type="date">
    document.getElementById('editStartDate').value = insurance.start_date?.slice(0, 10);
    document.getElementById('editEndDate').value = insurance.end_date?.slice(0, 10);

    modal.show();
}

// ============================
// Pagination Setup
// ============================
let itemsPerPage = 10;
let currentPage = 1;
let transactionRows = [];
let totalTransactionItems = 0;

function displayTransactions(page) {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    transactionRows.forEach((row, index) => {
        row.style.display = (index >= start && index < end) ? '' : 'none';
    });

    updatePaginationButtons(page);
}

function updatePaginationButtons(page) {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(totalTransactionItems / itemsPerPage);

    // Clear all buttons except prev & next
    pagination.innerHTML = '';

    // Previous button
    const prev = document.createElement('li');
    prev.className = 'page-item' + (page === 1 ? ' disabled' : '');
    prev.innerHTML = `<a class="page-link" href="#">&laquo;</a>`;
    prev.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            displayTransactions(currentPage);
        }
    });
    pagination.appendChild(prev);

    // Number buttons
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === page ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            displayTransactions(i);
        });
        pagination.appendChild(li);
    }

    // Next button
    const next = document.createElement('li');
    next.className = 'page-item' + (page === totalPages ? ' disabled' : '');
    next.innerHTML = `<a class="page-link" href="#">&raquo;</a>`;
    next.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
                currentPage++;
                displayTransactions(currentPage);
            }
        });
    pagination.appendChild(next);
    }

    window.updateLimit = () => {
        itemsPerPage = parseInt(document.getElementById('limitSelect').value);
        currentPage = 1;
        displayTransactions(currentPage);
    };

    document.addEventListener('DOMContentLoaded', () => {
        transactionRows = Array.from(document.querySelectorAll('.transaction-row'));
        totalTransactionItems = transactionRows.length;
        displayTransactions(currentPage);
    });

function showToast(message, type = 'success') {
    const toastElement = document.getElementById('actionToast');
    const toastMessage = document.getElementById('toastMessage');

    toastElement.className = `toast align-items-center text-bg-${type} border-0`; // success, warning, danger
    toastMessage.textContent = message;

    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    toast.show();
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('success');

    if (action === 'add') {
        showToast('Data appointments berhasil ditambahkan', 'success');
    } else if (action === 'edit') {
        showToast('Data appointments berhasil diubah', 'warning');
    } else if (action === 'delete') {
        showToast('Data appoinmtents berhasil dihapus', 'danger');
    }
});


