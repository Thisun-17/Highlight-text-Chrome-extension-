// Code for handling saved items display
document.addEventListener('DOMContentLoaded', function() {
  // Fix existing items with invalid dates
  fixStoredDates();
  
  // Then load items for display
  loadSavedItems();
  
  // Set up tab navigation
  setupTabNavigation();
});

// Function to handle tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Get the tab to show
      const tabId = this.getAttribute('data-tab');
      
      // Remove active class from all buttons and tab panes
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      
      // Add active class to current button and tab pane
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}



// Function to fix invalid dates in stored items
function fixStoredDates() {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    let hasChanges = false;
    
    // Check each item and fix dates if needed
    savedItems.forEach(item => {
      // If missing timestamp (root level) or has invalid date
      if (!item.timestamp || isNaN(new Date(item.timestamp).getTime())) {
        // Add current timestamp
        const now = new Date().toISOString();
        item.timestamp = now;
        item.date = now; // For backwards compatibility
        hasChanges = true;
      }
    });
    
    // Save changes back to storage if needed
    if (hasChanges) {
      chrome.storage.local.set({savedItems: savedItems}, function() {
        console.log('Fixed invalid dates in stored items');
      });
    }
  });
}

// Function to load and display all saved items
function loadSavedItems() {
  const container = document.getElementById('items-container');
  
  // Clear the container first
  container.innerHTML = '';
  
  // Use our new unified function to load all content
  loadAllSavedContent().then(allItems => {
    if (allItems.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No saved items yet';
      container.appendChild(emptyState);
      return;
    }
    
    // Display items in order (already sorted by timestamp)
    allItems.forEach(function(item, index) {
      const itemElement = createItemCard(item);
      container.appendChild(itemElement);
      
      // Log the delete button for debugging - don't add another click handler
      const deleteBtn = itemElement.querySelector('.delete-btn');
      console.log('Delete button for item', item.id, ':', deleteBtn);
    });
  });
}

// Function to create a card for displaying an item
function createItemCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = item.id;
  card.dataset.type = item.type;
  
  // Create Widihata logo section
  const widihataSection = document.createElement('div');
  widihataSection.className = 'card-widihata';
  
  const widihataLogo = document.createElement('img');
  widihataLogo.className = 'widihata-logo';
  widihataLogo.src = 'icon.png'; // Using the extension icon as the Widihata logo
  widihataLogo.alt = 'Widihata';
  widihataSection.appendChild(widihataLogo);
  
  card.appendChild(widihataSection);
  
  // Create content section
  const cardContent = document.createElement('div');
  cardContent.className = 'card-content';
  
  // Create text paragraph
  const textElement = document.createElement('p');
  
  // Apply special styling for different types of content
  if (item.type === 'highlight' || item.isHighlight) {
    textElement.className = 'highlight-text';
    textElement.style.backgroundColor = 'var(--highlight-bg)';
    card.dataset.isHighlight = "true";
  }
  else if (item.type === 'article') {
    textElement.className = 'article-text';
  }
  else if (item.type === 'fullpage') {
    textElement.className = 'fullpage-text';
    card.classList.add('article-card');
  }
  
  // Get text content based on item type and structure
  if (item.type === 'fullpage') {
    // For full page content, use excerpt in card view
    if (item.excerpt) {
      textElement.textContent = item.excerpt;
    } else if (item.content && item.content.excerpt) {
      textElement.textContent = item.content.excerpt;
    } else if (item.content && item.content.content) {
      // If no excerpt, show beginning of content
      const fullContent = item.content.content;
      textElement.textContent = fullContent.substring(0, 150) + (fullContent.length > 150 ? '...' : '');
    } else {
      textElement.textContent = item.text || 'Full page content saved';
    }
  } else {
    // Standard text handling for other item types
    textElement.textContent = item.text || 
      (item.content && typeof item.content === 'string' ? item.content : 
      (item.content && item.content.text ? item.content.text : ''));
  }

  // Add title
  const title = item.title || item.pageTitle;
  if (title) {
    const titleElement = document.createElement('div');
    titleElement.className = 'card-title';
    titleElement.textContent = title;
    cardContent.appendChild(titleElement);
  }

  // Add description
  let description = item.excerpt || item.description || (item.content && item.content.excerpt) || (item.content && item.content.content && item.content.content.excerpt) || item.text || (item.content && typeof item.content === 'string' ? item.content : (item.content && item.content.text ? item.content.text : ''));

  // Add notes
  const notes = item.notes || (item.content && item.content.notes);
  if (notes) {
    description = (description ? description + '\n\n' : '') + 'Note: ' + notes;
  }

  if (description) {
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'card-description';
    descriptionElement.textContent = description;
    cardContent.appendChild(descriptionElement);
  }  // Add URL - enhanced to ensure full page URLs are displayed
  let url = item.pageUrl || item.url || (item.content && item.content.pageUrl) || (item.content && item.content.url);
  
  // Special handling for full page items to ensure URL is always displayed
  if (item.type === 'fullpage' && !url) {
    // Try even harder to find a URL for full page content
    url = item.content?.url || item.content?.pageUrl || 
          (item.content && item.content.content && item.content.content.url) ||
          (item.content && item.content.content && item.content.content.pageUrl);
  }
    if (url) {
    const urlContainer = document.createElement('div');
    urlContainer.className = 'url-container';
    
    // Create icon for URL
    const urlIcon = document.createElement('i');
    urlIcon.className = 'fas fa-link';
    urlIcon.style.marginRight = '6px';
    urlIcon.style.fontSize = '12px';
    urlContainer.appendChild(urlIcon);
    
    const urlElement = document.createElement('a');
    urlElement.className = 'card-url';
    urlElement.href = url;
    try {
      const urlObj = new URL(url);
      urlElement.textContent = urlObj.hostname;
    } catch (e) {
      urlElement.textContent = url;
    }
    urlElement.target = '_blank';
    urlContainer.appendChild(urlElement);
    
    cardContent.appendChild(urlContainer);
  }

  // Add thumbnail
  if (item.thumbnail) {
    const thumbnailElement = document.createElement('div');
    thumbnailElement.className = 'card-thumbnail';
    const imgElement = document.createElement('img');
    imgElement.src = item.thumbnail;
    imgElement.alt = 'Thumbnail';
    thumbnailElement.appendChild(imgElement);
    card.appendChild(thumbnailElement);
  }

  // Create actions container for buttons
  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';

  // Create menu button with dropdown
  const menuButton = document.createElement('button');
  menuButton.className = 'card-action-btn menu-btn';
  menuButton.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
  menuButton.title = "Menu options";
  menuButton.setAttribute('aria-label', 'Item options menu');

  // Create unique ID for this dropdown
  const dropdownId = `dropdown-${item.id}`;
  menuButton.dataset.dropdownId = dropdownId;

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu';
  dropdown.id = dropdownId;

  // Store the type based on item properties
  const itemType = item.isHighlight ? 'highlight' : (item.type || 'text');

  // Add menu items - only keeping Add note and Delete as requested
  const menuItems = [
    { icon: 'fa-sticky-note', text: 'Add note', action: () => addNoteToItem(item) },
    { icon: 'fa-share-alt', text: 'Share', action: () => shareItem(item) },
    { icon: 'fa-trash-alt', text: 'Delete', action: () => {
      if (confirm('Are you sure you want to delete this item?')) {
        deleteItem(item.id, itemType);
      }
    }}
  ];

  menuItems.forEach(menuItem => {
    const item = document.createElement('button');
    item.className = 'dropdown-item';
    item.innerHTML = `<i class="fas ${menuItem.icon}"></i> ${menuItem.text}`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menuItem.action();
      dropdown.classList.remove('show');
    });
    dropdown.appendChild(item);
  });

  // Toggle dropdown on menu button click
  menuButton.addEventListener('click', function(e) {
    e.stopPropagation();

    // Close all other open dropdowns first
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
      if (menu.id !== dropdownId) {
        menu.classList.remove('show');
      }
    });

    dropdown.classList.toggle('show');

    // Close dropdown when clicking elsewhere
    const closeDropdown = function(event) {
      if (!menuButton.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeDropdown);
      }
    };

    if (dropdown.classList.contains('show')) {      // Ensure dropdown is within viewport
      const dropdownRect = dropdown.getBoundingClientRect();

      // If the dropdown would appear outside the viewport at the top
      if (dropdownRect.top < 0) {
        dropdown.style.bottom = 'auto';
        dropdown.style.top = '36px';
      }

      // Position the dropdown
      positionDropdown();

      setTimeout(() => {
        document.addEventListener('click', closeDropdown);
      }, 0);
    }
  });
    // Position the dropdown relative to the menu button
  const positionDropdown = () => {
    const buttonRect = menuButton.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.bottom = `${window.innerHeight - buttonRect.top}px`;
    dropdown.style.right = `${window.innerWidth - buttonRect.right}px`;
  };

  // Position initially and on window resize
  window.addEventListener('resize', positionDropdown);
  menuButton.addEventListener('click', positionDropdown);

  // Add the menu button and dropdown to card actions
  cardActions.appendChild(menuButton);
  // Append dropdown to the body instead of card to avoid clipping issues
  document.body.appendChild(dropdown);

  // Add the actions to the card
  card.appendChild(cardContent);
  card.appendChild(cardActions);

  // Add thumbnail
  if (item.thumbnail) {
    const thumbnailElement = document.createElement('div');
    thumbnailElement.className = 'card-thumbnail';
    const imgElement = document.createElement('img');
    imgElement.src = item.thumbnail;
    imgElement.alt = 'Thumbnail';
    thumbnailElement.appendChild(imgElement);
    card.appendChild(thumbnailElement);
  }

  return card;
}

// Placeholder functions for the menu actions
function shareItem(item) {
  console.log('Share item:', item);
  // Implementation to be added later
}

function addNoteToItem(item) {
  console.log('Add note to item:', item);
  // Implementation to be added later
}

function addToCollection(item) {
  console.log('Add to collection:', item);
  // Implementation to be added later
}

function toggleFavorite(item) {
  console.log('Toggle favorite:', item);
  // Implementation to be added later
}

function togglePrivate(item) {
  console.log('Toggle private:', item);
  // Implementation to be added later
}

// Function to delete an item
function deleteItem(id, type) {
  console.log('Delete item called with ID:', id, 'type:', type);
  
  // Clean up dropdown elements
  const dropdown = document.getElementById(`dropdown-${id}`);
  if (dropdown) {
    dropdown.remove();
  }
  
  // Show temporary deletion notification
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = 'Deleting item...';
  document.body.appendChild(notification);
  
  // Remove the item from the UI immediately for better UX
  const itemCard = document.querySelector(`.card[data-id="${id}"]`);
  if (itemCard) {
    itemCard.classList.add('card-fade-out');
    console.log('Found and applied fade-out to card element:', itemCard);
  } else {
    console.error('Card element not found in DOM for id:', id);
  }
  
  // First try to remove from savedItems (legacy items)
  chrome.storage.local.get(['savedItems'], function(result) {
    const items = result.savedItems || [];
    console.log('Found', items.length, 'items in savedItems storage');
    
    // Log the items with matching ID for debugging
    const matchingItems = items.filter(item => item.id === id);
    console.log('Matching items in savedItems:', matchingItems);
    
    const newItems = items.filter(item => item.id !== id);
    
    // If we found and removed the item from savedItems
    if (items.length !== newItems.length) {
      console.log('Item found in savedItems, removing...');
      chrome.storage.local.set({savedItems: newItems}, function() {
        console.log('Item deleted from savedItems:', id);
        showDeleteSuccessNotification(notification);
        setTimeout(() => loadSavedItems(), 300); // Short delay before reload
      });
      return;
    }
    
    console.log('Item not found in savedItems, checking savedTextItems...');
    
    // If not found in savedItems, try savedTextItems
    chrome.storage.local.get(['savedTextItems'], function(result) {
      const items = result.savedTextItems || [];
      console.log('Found', items.length, 'items in savedTextItems storage');
      
      // Log the items with matching ID for debugging
      const matchingItems = items.filter(item => item.id === id);
      console.log('Matching items in savedTextItems:', matchingItems);
      
      const newItems = items.filter(item => item.id !== id);
      
      // If we found and removed the item from savedTextItems
      if (items.length !== newItems.length) {
        console.log('Item found in savedTextItems, removing...');
        chrome.storage.local.set({savedTextItems: newItems}, function() {
          console.log('Item deleted from savedTextItems:', id);
          showDeleteSuccessNotification(notification);
          setTimeout(() => loadSavedItems(), 300); // Short delay before reload
        });
        return;
      }
      
      console.log('Item not found in savedTextItems, checking savedHighlights...');
      
      // If not found in savedTextItems, try savedHighlights
      chrome.storage.local.get(['savedHighlights'], function(result) {
        const items = result.savedHighlights || [];
        console.log('Found', items.length, 'items in savedHighlights storage');
        
        // Log the items with matching ID for debugging
        const matchingItems = items.filter(item => item.id === id);
        console.log('Matching items in savedHighlights:', matchingItems);
        
        const newItems = items.filter(item => item.id !== id);
        
        // If we found and removed the item from savedHighlights
        if (items.length !== newItems.length) {
          console.log('Item found in savedHighlights, removing...');
          chrome.storage.local.set({savedHighlights: newItems}, function() {
            console.log('Item deleted from savedHighlights:', id);
            showDeleteSuccessNotification(notification);
            setTimeout(() => loadSavedItems(), 300); // Short delay before reload
          });
          return;
        }
        
        // If we get here, the item wasn't found in any storage
        console.error('Item not found in any storage:', id);
        notification.textContent = 'Item not found!';
        notification.classList.add('error');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
          loadSavedItems(); // Reload anyway to ensure UI is consistent
        }, 2000);
      });
    });
  });
}

// Helper function to show success notification
function showDeleteSuccessNotification(notification) {
  notification.textContent = 'Item deleted successfully!';
  notification.classList.add('success');
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 1500);
}
