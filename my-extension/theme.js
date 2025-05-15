// Script to handle theme toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlElement = document.documentElement;
  
  // Check for saved theme preference in local storage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    htmlElement.setAttribute('data-theme', savedTheme);
  } else {
    // Check for system preference if no saved theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      htmlElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  }
  
  // Toggle theme on button click
  themeToggleBtn.addEventListener('click', function() {
    const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Set new theme
    htmlElement.setAttribute('data-theme', newTheme);
    
    // Save preference
    localStorage.setItem('theme', newTheme);
    
    // Animate the icon
    themeToggleBtn.classList.add('rotate');
    setTimeout(() => {
      themeToggleBtn.classList.remove('rotate');
    }, 300);
  });
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (!localStorage.getItem('theme')) { // Only apply if user hasn't set preference
        const newTheme = event.matches ? 'dark' : 'light';
        htmlElement.setAttribute('data-theme', newTheme);
      }
    });
  }
});
