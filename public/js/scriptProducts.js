// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');

    sidebar.classList.toggle('open');
    content.style.marginLeft = sidebar.classList.contains('open') ? '0' : '250px';
}

// Toggle Dark Mode
function toggleDarkMode() {
    const body = document.body;
    const darkModeButton = document.querySelector('.btn-outline-secondary');

    body.classList.toggle('dark-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
    darkModeButton.innerHTML = body.classList.contains('dark-mode')
        ? '<i class="fa fa-sun"></i>'
        : '<i class="fa fa-moon"></i>';
}

// Load Theme from LocalStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}

// Search Products
function searchProducts() {
    const query = document.getElementById('productSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('.product-row');

    rows.forEach(row => {
        const id = row.children[0].textContent.toLowerCase();
        const name = row.children[1].textContent.toLowerCase();
        const category = row.children[3].textContent.toLowerCase();

        row.style.display = (id.includes(query) || name.includes(query) || category.includes(query)) ? '' : 'none';
    });
}

// Set Delete Action
function setDeleteAction(actionUrl, productName) {
    const form = document.getElementById('deleteProductForm');
    form.action = actionUrl;

    const modalDescription = document.getElementById('deleteProductModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete <strong>${productName}</strong>? This action cannot be undone.</p>`;
}

function previewAddProductImage(event) {
    const preview = document.getElementById('addProductImagePreview');
    const file = event.target.files[0];

    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        preview.alt = file.name;
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
}

// Set Update Action
function editProductRecord(buttonElement) {
    const product = JSON.parse(buttonElement.getAttribute('data-record'));

    if (!product || !product.id_products) {
        console.error('Missing product ID');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('editProductModal'));

    // Set action form
    document.getElementById('editProductForm').action = `/products/${product.id_products}?_method=PUT`;

    // Set field values
    document.getElementById('editProductName').value = product.name || '';
    document.getElementById('editBarcode').value = product.barcode || '';
    document.getElementById('editCategory').value = product.category_id || '';
    document.getElementById('editBrand').value = product.brand || '';
    document.getElementById('editDescription').value = product.description || '';
    document.getElementById('editUnit').value = product.unit_id || '';
    document.getElementById('editStatus').value = product.status || '1';

    // Handle image preview
    const productImagePreview = document.getElementById('editProductImagePreview');

    if (product.product_image && typeof product.product_image === 'string') {
        let imagePath = product.product_image;

        // Periksa apakah path sudah lengkap
        if (!imagePath.startsWith('/img/productimg/')) {
            imagePath = `/img/productimg/${imagePath}`;
        }

        // Pastikan path gambar valid dan bisa diakses
        console.log('Image Path:', imagePath);

        // Update source of the image preview
        productImagePreview.src = imagePath;

        // Show the image preview
        productImagePreview.style.display = 'block';
        productImagePreview.alt = `Image of ${product.name}`;
    } else {
        // Hide the image preview if no image exists
        productImagePreview.src = '';
        productImagePreview.style.display = 'none';
    }

    modal.show();
}

// Toast Notification
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('actionToast');
    const toastMsg = document.getElementById('toastMessage');

    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastMsg.textContent = message;

    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
    toast.show();
}

// Pagination Handling
let productsPerPage, currentPage, productRows, totalProducts;

const displayProducts = (page) => {
    const start = (page - 1) * productsPerPage;
    const end = start + productsPerPage;
    productRows.forEach((row, i) => {
        row.style.display = (i >= start && i < end) ? '' : 'none';
    });
};

const setupPagination = () => {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item${i === currentPage ? ' active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', e => {
            e.preventDefault();
            currentPage = i;
            displayProducts(currentPage);
            setupPagination();
        });
        pagination.appendChild(li);
    }
};

// Update Limit (items per page)
window.updateLimit = () => {
    productsPerPage = parseInt(document.getElementById('limitSelect').value);
    currentPage = 1;
    displayProducts(currentPage);
    setupPagination();
};

// Document Ready Setup
document.addEventListener('DOMContentLoaded', () => {
    productsPerPage = parseInt(document.getElementById('limitSelect').value);
    currentPage = 1;
    productRows = document.querySelectorAll('#productList tr');
    totalProducts = productRows.length;

    displayProducts(currentPage);
    setupPagination();

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('success');
    const productId = urlParams.get('id'); // Ambil ID dari URL

    if (action === 'add') showToast(`Product ${productId} successfully added`);
    else if (action === 'edit') showToast(`Product ${productId} successfully updated`, 'warning');
    else if (action === 'delete') showToast(`Product ${productId} successfully deleted`, 'danger');
});
