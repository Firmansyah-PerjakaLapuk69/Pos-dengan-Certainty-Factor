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
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const darkModeButton = document.querySelector('.btn-outline-secondary');
    if (darkModeButton) {
        darkModeButton.innerHTML = '<i class="fa fa-sun"></i>';
    }
}

// Search Users
function searchUsers() {
    const query = document.getElementById('userSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#userList tr');

    rows.forEach(row => {
        const id = row.children[0].textContent.toLowerCase();
        const name = row.children[1].textContent.toLowerCase();
        const email = row.children[2].textContent.toLowerCase();

        row.style.display = (id.includes(query) || name.includes(query) || email.includes(query)) ? '' : 'none';
    });
}

// Set Delete User Action
function setDeleteUserAction(actionUrl, userName) {
    const form = document.getElementById('deleteUserForm');
    form.action = actionUrl;

    const modalDescription = document.getElementById('deleteUserModalDescription');
    modalDescription.innerHTML = `<p>Are you sure you want to delete <strong>${userName}</strong>? This action cannot be undone.</p>`;
}

// Preview Add User Image
function previewAddUserImage(event) {
    const preview = document.getElementById('addUserImagePreview');
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

// Preview Edit User Image
function previewEditUserImage(event) {
    const preview = document.getElementById('editUserImagePreview');
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

// Set Edit User Action & Populate Modal
function editUserRecord(buttonElement) {
    const user = JSON.parse(buttonElement.getAttribute('data-record'));

    if (!user || !user.id_users) {
        console.error('Missing user ID');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));

    // Set action form with prefix /users_pos
    document.getElementById('editUserForm').action = `/users_pos/${user.id_users}?_method=PUT`;

    // Set field values...
    document.getElementById('editName').value = user.name || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPassword').value = ''; // always blank
    document.getElementById('editRole').value = user.role || 'cashier';

    // Image preview handling...
    const userImagePreview = document.getElementById('editUserImagePreview');

    if (user.users_img && user.users_img !== 'default.png') {
        let imagePath = user.users_img;
        if (!imagePath.startsWith('/img/userimg/')) {
            imagePath = `/img/userimg/${imagePath}`;
        }
        userImagePreview.src = imagePath;
        userImagePreview.style.display = 'block';
        userImagePreview.alt = `Image of ${user.name}`;
    } else {
        userImagePreview.src = '/img/userimg/default.png';
        userImagePreview.style.display = 'block';
        userImagePreview.alt = 'Default User Image';
    }

    modal.show();
}

let usersPerPage;
let currentPage;
let userRows;   // Semua baris user
let totalUsers; // Total baris

// Fungsi untuk menampilkan data pada halaman tertentu
const displayUsers = (page) => {
    const start = (page - 1) * usersPerPage;
    const end = start + usersPerPage;
    userRows.forEach((row, index) => {
        row.style.display = (index >= start && index < end) ? '' : 'none';
    });

    // Update tombol Previous/Next aktif/nonaktif
    document.getElementById('previousPage').classList.toggle('disabled', page === 1);
    document.getElementById('nextPage').classList.toggle('disabled', page === Math.ceil(totalUsers / usersPerPage));
};

// Fungsi untuk membangun ulang pagination (nomor halaman)
const setupPagination = () => {
    const paginationElement = document.getElementById('pagination');
    const totalPages = Math.ceil(totalUsers / usersPerPage);

    // Hapus semua item pagination kecuali previous dan next
    const pageItems = paginationElement.querySelectorAll('.page-item:not(#previousPage):not(#nextPage)');
    pageItems.forEach(item => item.remove());

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentPage ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            displayUsers(currentPage);
            setupPagination();
        });
        paginationElement.insertBefore(li, document.getElementById('nextPage'));
    }
};

// Fungsi saat jumlah tampilan per halaman berubah
function updateLimit() {
    usersPerPage = parseInt(document.getElementById('limitSelect').value);
    userRows = document.querySelectorAll('#userList tr');
    totalUsers = userRows.length;
    currentPage = 1;
    setupPagination();
    displayUsers(currentPage);
}

// Fungsi tombol Previous dan Next
const setupNavigationButtons = () => {
    document.getElementById('previousPage').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            displayUsers(currentPage);
            setupPagination();
        }
    });

    document.getElementById('nextPage').addEventListener('click', (e) => {
        e.preventDefault();
        const totalPages = Math.ceil(totalUsers / usersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayUsers(currentPage);
            setupPagination();
        }
    });
};

// Inisialisasi saat DOM sudah siap
document.addEventListener('DOMContentLoaded', function() {
    usersPerPage = parseInt(document.getElementById('limitSelect').value);
    currentPage = 1;
    userRows = document.querySelectorAll('#userList tr');
    totalUsers = userRows.length;

    setupNavigationButtons();
    setupPagination();
    displayUsers(currentPage);
});

// Toast Notification
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('actionToast');
    const toastMsg = document.getElementById('toastMessage');

    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastMsg.textContent = message;

    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
    toast.show();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    usersPerPage = parseInt(document.getElementById('limitSelect').value) || 10;
    currentPage = 1;
    userRows = document.querySelectorAll('#userList tr');
    totalUsers = userRows.length;

    displayUsers(currentPage);
    setupPagination();

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('success');
    const userId = urlParams.get('id');

    if (action === 'add') showToast(`User ${userId} successfully added`);
    else if (action === 'edit') showToast(`User ${userId} successfully updated`, 'warning');
    else if (action === 'delete') showToast(`User ${userId} successfully deleted`, 'danger');
});
