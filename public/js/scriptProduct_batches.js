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

// JavaScript for searching product batches based on batch ID, product name, or other attributes
function searchProductBatches() {
    const query = document.getElementById('batchSearchInput').value.toLowerCase();
    const batchRows = document.querySelectorAll('.batch-row');  // Get all batch rows

    batchRows.forEach(row => {
        // Extract text content from the relevant columns
        const batchId = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const productName = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const manufacturer = row.querySelector('td:nth-child(3)').textContent.toLowerCase();

        // Check if the query matches any of the fields (batch ID, product name, or manufacturer)
        if (
            batchId.includes(query) ||
            productName.includes(query) ||
            manufacturer.includes(query)
        ) {
            row.style.display = '';  // Show row if it matches the query
        } else {
            row.style.display = 'none';  // Hide row if it doesn't match the query
        }
    });
}

// Set delete action for the modal
function setDeleteAction(actionUrl, recordId) {
    const form = document.getElementById('deleteBatchForm');
    form.action = actionUrl;  // Set the form action URL to the delete URL

    const modalDescription = document.getElementById('deleteBatchModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete the batch product record for Batch ID <strong>${recordId}</strong>? This action cannot be undone.</p>`;
}

// Set edit action for the modal
function editBatchRecord(buttonElement) {
    const batch = JSON.parse(buttonElement.getAttribute('data-record'));

    if (!batch || !batch.id_product_batches) {
        console.error('Missing id_product_batches');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('editBatchModal'));

    // Set form action URL
    document.getElementById('editBatchForm').action = `/product_batches/${batch.id_product_batches}?_method=PUT`;

    // Isi semua input di modal dengan data yang sesuai
    document.getElementById('editProduct').value = batch.product_id;
    document.getElementById('editBatchNumber').value = batch.batch_number;
    document.getElementById('editExpiryDate').value = batch.expiry_date?.slice(0, 10);
    document.getElementById('editStock').value = batch.stock;
    document.getElementById('editPurchasePrice').value = batch.purchase_price;
    document.getElementById('editSellingPrice').value = batch.selling_price;

    modal.show();
}

// ============================
// Global variables for pagination
// ============================
let batchesPerPage = 10;  // Default number of records per page
let currentPage = 1;      // Initial page
let batchRecords;         // Store batch row elements
let totalBatchRecords;    // Total number of batch records

// ============================
// Function to display batch records for the selected page
// ============================
const displayBatches = (page) => {
    const start = (page - 1) * batchesPerPage;  // Calculate the starting index
    const end = start + batchesPerPage;         // Calculate the ending index

    // Loop through all batch rows and show/hide based on page
    batchRecords.forEach((batch, index) => {
        batch.style.display = (index >= start && index < end) ? '' : 'none';
    });

    // Update pagination buttons based on the current page
    updatePaginationButtons(page);
};

// ============================
// Function to update pagination buttons
// ============================
const updatePaginationButtons = (page) => {
    const paginationElement = document.getElementById('pagination');
    const totalPages = Math.ceil(totalBatchRecords / batchesPerPage);

    // Get Previous and Next buttons
    const previousButton = document.getElementById('previousPage');
    const nextButton = document.getElementById('nextPage');

    // Enable/Disable the previous and next buttons
    previousButton.classList.toggle('disabled', page === 1);
    nextButton.classList.toggle('disabled', page === totalPages);

    // Clear current page buttons before re-adding
    paginationElement.innerHTML = '';

    // Add Previous page button
    paginationElement.appendChild(previousButton);

    // Create page number buttons dynamically
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === page ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            displayBatches(currentPage);
        });
        paginationElement.appendChild(li);
    }

    // Add Next page button
    paginationElement.appendChild(nextButton);
};

// ============================
// Function to update the limit of batch records per page
// ============================
window.updateLimit = () => {
    batchesPerPage = parseInt(document.getElementById('limitSelect').value);  // Get new value from dropdown
    currentPage = 1;  // Reset to the first page after changing the limit
    displayBatches(currentPage);  // Display batch records on the new page
};

// ============================
// Initialize pagination and display the records when the page loads
// ============================
document.addEventListener('DOMContentLoaded', function() {
    // Get all batch rows from the table
    batchRecords = Array.from(document.querySelectorAll('#batchList tr'));  // Convert NodeList to Array
    totalBatchRecords = batchRecords.length;  // Get total batch rows

    // Display batch records on the first page
    displayBatches(currentPage);
    
    // Setup pagination buttons based on the total number of batch records
    updatePaginationButtons(currentPage);
});

// Toast notification function
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

// Success messages for different actions
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('success');
    const id = urlParams.get('id');

    if (action === 'add') {
        showToast(`Product batch (ID: ${id}) successfully added`, 'success');
    } else if (action === 'edit') {
        showToast(`Product batch (ID: ${id}) successfully updated`, 'warning');
    } else if (action === 'delete') {
        showToast(`Product batch (ID: ${id}) successfully deleted`, 'danger');
    }
});
