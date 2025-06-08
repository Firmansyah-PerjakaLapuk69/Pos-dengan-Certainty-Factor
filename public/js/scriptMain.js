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