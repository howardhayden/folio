// Get the Search dropdown-menu element
const dropdown = document.querySelector('.dropdown');
const dropdownMenu = document.querySelector('.dropdown-menu');
const restOfPage = document.querySelector('.container');
const dropdownToggle = document.querySelector('.dropdown-toggle');

dropdownToggle.addEventListener('click', function(e) {
  e.stopPropagation();
  dropdown.classList.toggle('show');
  dropdownMenu.classList.toggle('show');
});

document.addEventListener('click', function(e) {
  if (dropdown.contains(e.target)) {
    // Click was inside dropdown, so return without hiding dropdown
    return;
  }
  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
    dropdownMenu.classList.remove('show');
  }
});

// Function to handle dropdown state
function handleDropdownState() {
  // Apply the blur effect with fade in transition if dropdown is open
  if (dropdown.classList.contains('show')) {
    restOfPage.style.transition = "filter 0.5s";
    restOfPage.style.filter = "blur(5px)";
  } 
  // Remove the blur effect with fade out transition if dropdown is closed
  else {
    restOfPage.style.transition = "filter 0.5s";
    restOfPage.style.filter = "none";
  }
}

// Listen for changes in the dropdown's classes
const dropdownObserver = new MutationObserver(handleDropdownState);

dropdownObserver.observe(dropdown, { attributes: true, attributeFilter: ['class'] });
