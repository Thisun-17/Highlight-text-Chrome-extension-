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
    // Create card content container
  const cardContent = document.createElement('div');
  cardContent.className = 'card-content';

  // Create source info container
  const sourceInfoContainer = document.createElement('div');
  sourceInfoContainer.className = 'source-info';

  // Add favicon if we can get it from the URL
  if (item.pageUrl) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(item.pageUrl).hostname}`;
    const faviconImg = document.createElement('img');
    faviconImg.className = 'source-favicon';
    faviconImg.src = faviconUrl;
    sourceInfoContainer.appendChild(faviconImg);
  }

  // Add title and URL
  const titleUrlContainer = document.createElement('div');
  titleUrlContainer.className = 'title-url-container';

  if (item.pageTitle) {
    const titleElement = document.createElement('div');
    titleElement.className = 'card-title';
    titleElement.textContent = item.pageTitle;
    titleUrlContainer.appendChild(titleElement);
  }

  if (item.pageUrl) {
    const urlElement = document.createElement('a');
    urlElement.className = 'card-url';
    urlElement.href = item.pageUrl;
    urlElement.textContent = new URL(item.pageUrl).hostname;
    urlElement.target = '_blank';
    titleUrlContainer.appendChild(urlElement);
  }

  sourceInfoContainer.appendChild(titleUrlContainer);
  cardContent.appendChild(sourceInfoContainer);

  // Add text content
  const textElement = document.createElement('div');
  textElement.className = 'card-text';
  // Style based on item type
  if (item.type === 'highlight' || item.isHighlight) {
    textElement.className = 'highlight-text';
    card.dataset.isHighlight = "true";
  }
  else if (item.type === 'article') {
    textElement.className = 'article-text';
  }
  else if (item.type === 'fullpage') {
    textElement.className = 'fullpage-text';
    card.classList.add('article-card');
  }
  // Set text content
  textElement.textContent = item.text || '';
  cardContent.appendChild(textElement);

  // Add notes if they exist
  if (item.notes && item.notes.trim()) {
    const notesContainer = document.createElement('div');
    notesContainer.className = 'item-notes';
    
    const notesLabel = document.createElement('span');
    notesLabel.className = 'notes-label';
    notesLabel.textContent = 'Note: ';
    
    const notesContent = document.createElement('span');
    notesContent.className = 'notes-content';
    notesContent.textContent = item.notes;
    
    notesContainer.appendChild(notesLabel);
    notesContainer.appendChild(notesContent);
    cardContent.appendChild(notesContainer);
  }

  // We've moved the URL to the source-info section

  // Create menu button
  const menuButton = document.createElement('button');
  menuButton.className = 'menu-btn';
  menuButton.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
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
  const itemType = item.isHighlight ? 'highlight' : (item.type || 'text');  // Add menu items
  const menuItems = [
    { icon: 'fa-pen', text: 'Edit Note', action: () => {
      console.log('Edit Note menu item clicked for item:', item);
      addNoteToItem(item);
    }},
    { icon: 'fa-trash-alt', text: 'Delete', action: () => {
      console.log('Delete menu item clicked for item:', item);
      if (confirm('Are you sure you want to delete this item?')) {
        deleteItem(item.id, itemType);
      }
    }}
  ];

  // Create menu items
  menuItems.forEach(menuItem => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.innerHTML = `<i class="fas ${menuItem.icon}"></i> ${menuItem.text}`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menuItem.action();
      dropdown.classList.remove('show');
    });
    dropdown.appendChild(item);
  });
  // Add menu button click handler
  menuButton.addEventListener('click', (e) => {
    console.log('Menu button clicked for item:', item.id);
    e.stopPropagation();
    const isVisible = dropdown.classList.contains('show');
    
    // Hide all other dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    
    // Toggle this dropdown
    if (!isVisible) {
      console.log('Showing dropdown for item:', item.id);
      dropdown.classList.add('show');
    } else {
      console.log('Hiding dropdown for item:', item.id);
    }
  });

  // Add event listener to close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });

  // Append everything to the card
  card.appendChild(cardContent);
  card.appendChild(menuButton);
  card.appendChild(dropdown);

  return card;
}

// Placeholder functions for the menu actions
function shareItem(item) {
  // Implementation from utils.js
  window.shareItem(item);
}

function addNoteToItem(item) {
  console.log('addNoteToItem called with item:', item);
  
  // Create the note input modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Add/Edit Note</h3>
      <textarea class="note-input" placeholder="Enter your note here...">${item.notes || ''}</textarea>
      <div class="modal-buttons">
        <button class="save-note">Save</button>
        <button class="cancel-note">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('Modal appended to body');

  // Add event listeners
  const textarea = modal.querySelector('.note-input');
  const saveButton = modal.querySelector('.save-note');
  const cancelButton = modal.querySelector('.cancel-note');

  saveButton.addEventListener('click', () => {
    console.log('Save button clicked');
    const noteText = textarea.value.trim();
    console.log('Note text:', noteText);
    
    const storageKey = item.isHighlight ? 'savedHighlights' : 
                      (item.type === 'text' ? 'savedTextItems' : 'savedItems');
    console.log('Storage key:', storageKey);
      // Check if chrome.storage is available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([storageKey], function(result) {
        console.log('Storage result:', result);
        const items = result[storageKey] || [];
        const itemIndex = items.findIndex(i => i.id === item.id);
        console.log('Item index:', itemIndex);
        
        if (itemIndex !== -1) {
          items[itemIndex].notes = noteText;
          chrome.storage.local.set({ [storageKey]: items }, function() {
            console.log('Note saved to storage');
            // Update the note in the card immediately (no reload)
            const card = document.querySelector(`.card[data-id='${item.id}']`);
            if (card) {
              let notesContainer = card.querySelector('.item-notes');
              if (!notesContainer && noteText) {
                // If no notes container exists and note is added, create it
                notesContainer = document.createElement('div');
                notesContainer.className = 'item-notes';
                const notesLabel = document.createElement('span');
                notesLabel.className = 'notes-label';
                notesLabel.textContent = 'Note: ';
                const notesContent = document.createElement('span');
                notesContent.className = 'notes-content';
                notesContent.textContent = noteText;
                notesContainer.appendChild(notesLabel);
                notesContainer.appendChild(notesContent);
                // Insert before timestamp if possible
                const timestamp = card.querySelector('.timestamp');
                if (timestamp) {
                  card.querySelector('.card-content').insertBefore(notesContainer, timestamp);
                } else {
                  card.querySelector('.card-content').appendChild(notesContainer);
                }
              } else if (notesContainer) {
                // If notes container exists, update or remove
                const notesContent = notesContainer.querySelector('.notes-content');
                if (noteText) {
                  notesContent.textContent = noteText;
                  notesContainer.style.display = '';
                } else {
                  notesContainer.remove();
                }
              }
            }
            // Also update the item.notes property so future edits show the latest note
            item.notes = noteText;
            // Force update the cardContent if note was removed and re-added
            if (card) {
              card.classList.remove('card-fade-out');
            }
            
            // Check if showNotification function exists
            if (typeof showNotification === 'function') {
              showNotification('Note saved successfully!', 'success');
            } else {
              console.log('Note saved successfully!');
              alert('Note saved successfully!'); // Fallback
            }
          });
        } else {
          console.error('Item not found in storage');
          alert('Error: Item not found in storage');
        }
      });
    } else {
      console.error('Chrome storage API not available');
      alert('Error: Chrome storage API not available. This page must be opened as a Chrome extension.');
    }
    document.body.removeChild(modal);
  });

  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Focus the textarea
  textarea.focus();
}

function addToCollection(item) {
  // Not implemented yet
  console.log('Add to collection:', item);
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
