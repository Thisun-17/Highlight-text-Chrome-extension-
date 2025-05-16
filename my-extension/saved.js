// Code for handling saved items display
document.addEventListener('DOMContentLoaded', function() {
  // Fix existing items with invalid dates
  fixStoredDates();
  
  // Then load items for display
  loadSavedItems();
  
  // Set up the Delete All button functionality
  const deleteAllBtn = document.getElementById('delete-all-btn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', deleteAllItems);
  }
  
  // Set up filter functionality
  setupFilters();
});

// Setup filter buttons functionality
function setupFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  let currentFilter = 'all';
  
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all filter buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Get filter value
      currentFilter = this.dataset.filter;
      
      // Apply filter
      filterItems(currentFilter);
    });
  });
}

// Function to filter displayed items
function filterItems(filterType) {
  const cards = document.querySelectorAll('.card');
  
  cards.forEach(card => {
    if (filterType === 'all') {
      card.style.display = 'flex'; // Show all cards
    } else {
      // Show only cards that match the filter type
      const isHighlight = card.dataset.isHighlight === "true" || card.dataset.type === 'highlight';
      
      if ((filterType === 'highlight' && isHighlight) || 
          (filterType === 'text' && !isHighlight)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    }
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
    
    // Update Delete All button state
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
      if (allItems.length === 0) {
        deleteAllBtn.disabled = true;
        deleteAllBtn.classList.add('disabled');
      } else {
        deleteAllBtn.disabled = false;
        deleteAllBtn.classList.remove('disabled');
      }
    }
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
    card.classList.add('article-card');
  }
  
  textElement.textContent = item.text;
  cardContent.appendChild(textElement);
  
  // Add notes if available - check all possible locations
  const notesText = item.notes || 
                   (item.content && item.content.notes) || 
                   (item.content && item.content.content && item.content.content.notes) || 
                   "";
                   
  if (notesText && notesText.trim() !== '') {
    const notesElement = document.createElement('div');
    notesElement.className = 'item-notes';
    
    const notesLabel = document.createElement('span');
    notesLabel.className = 'notes-label';
    notesLabel.textContent = 'Note: ';
    
    const notesContent = document.createElement('span');
    notesContent.className = 'notes-content';
    notesContent.textContent = notesText;
    
    notesElement.appendChild(notesLabel);
    notesElement.appendChild(notesContent);
    cardContent.appendChild(notesElement);
  }
  
  // Add source information if available
  if ((item.pageUrl || item.url) && (item.pageTitle || item.title)) {
    const sourceElement = document.createElement('div');
    sourceElement.className = 'source';
    
    // Get the appropriate URL
    const url = item.pageUrl || item.url;
    
    // Try to add favicon
    try {
      const faviconUrl = new URL(url);
      const faviconImg = document.createElement('img');
      faviconImg.src = `https://www.google.com/s2/favicons?domain=${faviconUrl.hostname}`;
      faviconImg.className = 'favicon';
      faviconImg.alt = '';
      sourceElement.appendChild(faviconImg);
      sourceElement.appendChild(document.createTextNode(' '));
    } catch (e) {
      console.log('Could not add favicon');
    }
    
    if (item.type === 'highlight' || item.isHighlight) {
      sourceElement.appendChild(document.createTextNode('Highlighted from: '));
    }
    else if (item.type === 'article') {
      sourceElement.appendChild(document.createTextNode('Article: '));
    }
    
    const sourceLink = document.createElement('a');
    sourceLink.href = url;
    sourceLink.textContent = item.title || item.pageTitle;
    sourceLink.target = '_blank';
    
    sourceElement.appendChild(sourceLink);
    cardContent.appendChild(sourceElement);
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
    
    if (dropdown.classList.contains('show')) {
      // Ensure dropdown is within viewport
      const dropdownRect = dropdown.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      if (dropdownRect.bottom > viewportHeight) {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = '36px';
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
    dropdown.style.top = `${buttonRect.bottom}px`;
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

// Function to delete all items
function deleteAllItems() {
  if (confirm('Are you sure you want to delete all saved items? This cannot be undone.')) {
    // Show deletion in progress
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const originalText = deleteAllBtn.textContent;
    deleteAllBtn.textContent = 'Deleting...';
    deleteAllBtn.disabled = true;
    
    // Create and show a temporary notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = 'Deleting all items...';
    document.body.appendChild(notification);
    
    // Delete all items from all storage types
    const clearOperations = [
      new Promise(resolve => chrome.storage.local.set({savedItems: []}, resolve)),
      new Promise(resolve => chrome.storage.local.set({savedTextItems: []}, resolve)),
      new Promise(resolve => chrome.storage.local.set({savedHighlights: []}, resolve))
    ];
    
    Promise.all(clearOperations).then(() => {
      // Reset button state
      setTimeout(function() {
        // Reload the items list (which will now be empty)
        loadSavedItems();
        deleteAllBtn.textContent = originalText;
        
        // Update notification
        notification.textContent = 'All highlights and saved text deleted!';
        notification.classList.add('success');
        
        // Remove notification after 3 seconds
        setTimeout(function() {
          notification.classList.add('fade-out');
          setTimeout(function() {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 2000);
      }, 500); // Small delay for visual feedback
    });
  }
}
