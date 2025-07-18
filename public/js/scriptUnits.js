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

// JavaScript untuk pencarian unit berdasarkan ID dan Nama
function searchUnits() {
    const query = document.getElementById('unitsSearchInput').value.toLowerCase();
    const unitRows = document.querySelectorAll('.unit-row');

    unitRows.forEach(row => {
        const id = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();

        row.style.display = (id.includes(query) || name.includes(query)) ? '' : 'none';
    });
};

// Function to set the delete action dynamically in the delete modal
function setDeleteAction(actionUrl, unitName) {
    const form = document.getElementById('deleteUnitForm');
    form.action = actionUrl;

    const modalDescription = document.getElementById('deleteUnitModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete unit <strong>${unitName}</strong>? This action cannot be undone.</p>`;
}

// Edit unit function which fills the form with unit data
function editUnit(buttonElement) {
    const unit = JSON.parse(buttonElement.getAttribute('data-unit'));

    // Set action form
    document.getElementById('editUnitForm').action = `/units/${unit.id_units}?_method=PUT`;

    // Fill form with unit data
    document.getElementById('editId').value = unit.id_units || '';
    document.getElementById('editName').value = unit.name || '';

    // Show the edit modal
    const editModal = new bootstrap.Modal(document.getElementById('editUnitModal'));
    editModal.show();
}

let unitsPerPage;
let currentUnitPage;
let units; // Semua baris unit
let totalUnits; // Jumlah total baris

// Fungsi untuk menampilkan data pada halaman tertentu
const displayUnits = (page) => {
    const start = (page - 1) * unitsPerPage;
    const end = start + unitsPerPage;
    units.forEach((unit, index) => {
        unit.style.display = (index >= start && index < end) ? '' : 'none';
    });

    // Update Previous/Next button state
    document.getElementById('previousPage').classList.toggle('disabled', page === 1);
    document.getElementById('nextPage').classList.toggle('disabled', page === Math.ceil(totalUnits / unitsPerPage));
};

// Fungsi untuk membangun ulang pagination
const setupUnitPagination = () => {
    const paginationElement = document.getElementById('pagination');
    const totalPages = Math.ceil(totalUnits / unitsPerPage);

    // Hapus semua item kecuali previous dan next
    const pageItems = paginationElement.querySelectorAll('.page-item:not(#previousPage):not(#nextPage)');
    pageItems.forEach(item => item.remove());

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentUnitPage ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentUnitPage = i;
            displayUnits(currentUnitPage);
            setupUnitPagination();
        });
        paginationElement.insertBefore(li, document.getElementById('nextPage'));
    }
};

// Fungsi ketika jumlah tampilan per halaman berubah
window.updateUnitLimit = () => {
    unitsPerPage = parseInt(document.getElementById('limitSelect').value);
    units = document.querySelectorAll('#unitList tr');
    totalUnits = units.length;
    currentUnitPage = 1;
    setupUnitPagination();
    displayUnits(currentUnitPage);
};

// Fungsi untuk tombol Previous dan Next
const setupNavigationButtons = () => {
    document.getElementById('previousPage').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUnitPage > 1) {
            currentUnitPage--;
            displayUnits(currentUnitPage);
            setupUnitPagination();
        }
    });

    document.getElementById('nextPage').addEventListener('click', (e) => {
        e.preventDefault();
        const totalPages = Math.ceil(totalUnits / unitsPerPage);
        if (currentUnitPage < totalPages) {
            currentUnitPage++;
            displayUnits(currentUnitPage);
            setupUnitPagination();
        }
    });
};

document.addEventListener('DOMContentLoaded', function() {
    unitsPerPage = parseInt(document.getElementById('limitSelect').value);
    currentUnitPage = 1;
    units = document.querySelectorAll('#unitList tr');
    totalUnits = units.length;

    setupNavigationButtons();
    displayUnits(currentUnitPage);
    setupUnitPagination();
});

// Fungsi untuk menampilkan toast dengan pesan tertentu
function showUnitToast(message, type = 'success') {
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
    const unitId = urlParams.get('id_units');  // Ambil ID unit dari URL

    if (action === 'add') {
        showUnitToast(`Unit with ID ${unitId} successfully added`, 'success');
    } else if (action === 'edit') {
        showUnitToast(`Unit with ID ${unitId} successfully updated`, 'warning');
    } else if (action === 'delete') {
        showUnitToast(`Unit with ID ${unitId} successfully deleted`, 'danger');
    }
});
