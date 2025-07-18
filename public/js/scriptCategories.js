// Function to toggle sidebar visibility
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    // Toggle the 'open' class on the sidebar
    sidebar.classList.toggle('open');
    
    // Adjust the content margin depending on the sidebar state
    if (sidebar.classList.contains('open')) {
        content.style.marginLeft = '0';  // When sidebar is hidden
    } else {
        content.style.marginLeft = '250px';  // When sidebar is visible
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

// Optional: Load the saved theme from localStorage when the page loads
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});

// JavaScript untuk pencarian kategori berdasarkan ID dan Nama
function searchCategories() {
    const query = document.getElementById('categoriesSearchInput').value.toLowerCase();
    const categoryRows = document.querySelectorAll('.category-row');

    categoryRows.forEach(row => {
        const id = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();

        row.style.display = (id.includes(query) || name.includes(query)) ? '' : 'none';
    });
};

// Function to set the delete action dynamically in the delete modal
function setDeleteAction(actionUrl, categoryName) {
    const form = document.getElementById('deleteCategoryForm');
    form.action = actionUrl;

    const modalDescription = document.getElementById('deleteCategoryModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete category <strong>${categoryName}</strong>? This action cannot be undone.</p>`;
}

// Edit category function which fills the form with category data
function editCategory(buttonElement) {
    const category = JSON.parse(buttonElement.getAttribute('data-category'));

    // Set action form
    document.getElementById('editCategoryForm').action = `/categories/${category.id_categories}?_method=PUT`;

    // Fill form with category data
    document.getElementById('editId').value = category.id_categories || '';
    document.getElementById('editName').value = category.name || '';

    // Show the edit modal
    const editModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
    editModal.show();
}

let categoriesPerPage;
let currentCategoryPage;
let categories;
let totalCategories;

// Tampilkan kategori untuk halaman tertentu
const displayCategories = (page) => {
    const start = (page - 1) * categoriesPerPage;
    const end = start + categoriesPerPage;
    categories.forEach((category, index) => {
        category.style.display = (index >= start && index < end) ? '' : 'none';
    });

    // Enable/disable tombol previous dan next
    document.getElementById('previousPage').classList.toggle('disabled', page === 1);
    document.getElementById('nextPage').classList.toggle('disabled', page === Math.ceil(totalCategories / categoriesPerPage));
};

// Setup ulang tombol pagination
const setupCategoryPagination = () => {
    const paginationElement = document.getElementById('pagination');
    const totalPages = Math.ceil(totalCategories / categoriesPerPage);

    // Hapus semua item selain previous dan next
    const pageItems = paginationElement.querySelectorAll('.page-item:not(#previousPage):not(#nextPage)');
    pageItems.forEach(item => item.remove());

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentCategoryPage ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentCategoryPage = i;
            displayCategories(currentCategoryPage);
            setupCategoryPagination();
        });
        paginationElement.insertBefore(li, document.getElementById('nextPage'));
    }
};

// Fungsi untuk mengatur ulang berdasarkan jumlah kategori per halaman
window.updateCategoryLimit = () => {
    categoriesPerPage = parseInt(document.getElementById('limitSelect').value);
    categories = document.querySelectorAll('#categoryList tr');
    totalCategories = categories.length;
    currentCategoryPage = 1;
    setupCategoryPagination();
    displayCategories(currentCategoryPage);
};

// Tangani tombol previous dan next
const setupNavigationButtons = () => {
    document.getElementById('previousPage').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentCategoryPage > 1) {
            currentCategoryPage--;
            displayCategories(currentCategoryPage);
            setupCategoryPagination();
        }
    });

    document.getElementById('nextPage').addEventListener('click', (e) => {
        e.preventDefault();
        const totalPages = Math.ceil(totalCategories / categoriesPerPage);
        if (currentCategoryPage < totalPages) {
            currentCategoryPage++;
            displayCategories(currentCategoryPage);
            setupCategoryPagination();
        }
    });
};

// Inisialisasi
document.addEventListener('DOMContentLoaded', function () {
    categoriesPerPage = parseInt(document.getElementById('limitSelect').value);
    currentCategoryPage = 1;
    categories = document.querySelectorAll('#categoryList tr');
    totalCategories = categories.length;

    setupNavigationButtons();
    displayCategories(currentCategoryPage);
    setupCategoryPagination();
});

// Fungsi untuk menampilkan toast dengan pesan tertentu
function showCategoryToast(message, type = 'success') {
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
    const categoryId = urlParams.get('id_categories');  // Ambil ID kategori dari URL

    if (action === 'add') {
        showCategoryToast(`Category with ID ${categoryId} successfully added`, 'success');
    } else if (action === 'edit') {
        showCategoryToast(`Category with ID ${categoryId} successfully updated`, 'warning');
    } else if (action === 'delete') {
        showCategoryToast(`Category with ID ${categoryId} successfully deleted`, 'danger');
    }
});
