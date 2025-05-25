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
  const itemType = item.isHighlight ? 'highlight' : (item.type || 'text');
  // Add menu items
  const menuItems = [
    { icon: 'fa-pen', text: 'Edit Note', action: () => {
      addNoteToItem(item);
    }},
    { icon: 'fa-trash-alt', text: 'Delete', action: () => {
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
    e.stopPropagation();
    const isVisible = dropdown.classList.contains('show');
    
    // Hide all other dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    
    // Toggle this dropdown
    if (!isVisible) {
      dropdown.classList.add('show');
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
  // Validate input
  if (!item || !item.id) {
    showNotification('Invalid item - cannot edit note', 'error');
    return;
  }

  // Create the note input modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Add/Edit Note</h3>
      <textarea class="note-input" placeholder="Enter your note here..." maxlength="2000">${item.notes || ''}</textarea>
      <div class="character-count">
        <span class="current-count">${(item.notes || '').length}</span>/2000 characters
      </div>
      <div class="modal-buttons">
        <button class="save-note">Save</button>
        <button class="cancel-note">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const textarea = modal.querySelector('.note-input');
  const saveButton = modal.querySelector('.save-note');
  const cancelButton = modal.querySelector('.cancel-note');
  const currentCount = modal.querySelector('.current-count');

  // Update character count as user types
  textarea.addEventListener('input', () => {
    const count = textarea.value.length;
    currentCount.textContent = count;
    if (count > 2000) {
      currentCount.style.color = 'red';
      saveButton.disabled = true;
    } else {
      currentCount.style.color = '';
      saveButton.disabled = false;
    }
  });

  // Enhanced save functionality with proper storage detection and error handling
  saveButton.addEventListener('click', () => {
    const noteText = textarea.value.trim();
    
    // Disable button to prevent double-clicks
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    // Enhanced storage key determination - check all possible storage locations
    const storageKeys = ['savedItems', 'savedTextItems', 'savedHighlights'];
    
    // Function to try updating in each storage location
    function tryUpdateInStorage(keyIndex = 0) {
      if (keyIndex >= storageKeys.length) {
        // Item not found in any storage - this shouldn't happen but handle gracefully
        console.error('Item not found in any storage location:', item.id);
        showNotification('Item not found - unable to save note', 'error');
        document.body.removeChild(modal);
        return;
      }

      const storageKey = storageKeys[keyIndex];
      
      chrome.storage.local.get([storageKey], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          showNotification('Storage error - unable to save note', 'error');
          document.body.removeChild(modal);
          return;
        }

        const items = result[storageKey] || [];
        const itemIndex = items.findIndex(i => i.id === item.id);
        
        if (itemIndex !== -1) {
          // Found the item in this storage location
          console.log(`Updating note for item ${item.id} in ${storageKey}`);
          
          // Update the note at the appropriate level based on storage structure
          if (storageKey === 'savedItems' && items[itemIndex].content) {
            // For savedItems, notes might be in content object or at root level
            items[itemIndex].notes = noteText;
            if (items[itemIndex].content) {
              items[itemIndex].content.notes = noteText;
            }
          } else {
            // For other storage types, notes are at root level
            items[itemIndex].notes = noteText;
          }
          
          // Save back to storage
          chrome.storage.local.set({ [storageKey]: items }, function() {
            if (chrome.runtime.lastError) {
              console.error('Error saving note:', chrome.runtime.lastError);
              showNotification('Failed to save note', 'error');
              document.body.removeChild(modal);
              return;
            }

            console.log(`Note successfully saved for item ${item.id} in ${storageKey}`);
            
            // Update the UI immediately without reloading
            updateNoteInUI(item.id, noteText);
            
            // Also update the item object for future operations
            item.notes = noteText;
            
            showNotification(noteText ? 'Note saved successfully!' : 'Note removed successfully!', 'success');
            document.body.removeChild(modal);
          });
        } else {
          // Item not found in this storage, try next one
          tryUpdateInStorage(keyIndex + 1);
        }
      });
    }

    // Start the update process
    tryUpdateInStorage();
  });

  // Handle modal close events
  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Close modal when clicking outside of it
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', escapeHandler);
    }
  });

  // Focus the textarea and place cursor at end
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// Helper function to update note display in UI
function updateNoteInUI(itemId, noteText) {
  const card = document.querySelector(`.card[data-id='${itemId}']`);
  if (!card) {
    console.warn(`Card not found for item ${itemId}`);
    return;
  }

  let notesContainer = card.querySelector('.item-notes');
  
  if (!notesContainer && noteText) {
    // Create new notes container if note is being added
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
    
    // Insert before timestamp/source info for better layout
    const cardContent = card.querySelector('.card-content');
    const timestamp = card.querySelector('.timestamp') || card.querySelector('.source-info');
    if (timestamp && cardContent) {
      cardContent.insertBefore(notesContainer, timestamp);
    } else if (cardContent) {
      cardContent.appendChild(notesContainer);
    }
    
    // Add subtle animation for new note
    notesContainer.style.opacity = '0';
    setTimeout(() => {
      notesContainer.style.transition = 'opacity 0.3s ease';
      notesContainer.style.opacity = '1';
    }, 10);
    
  } else if (notesContainer) {
    // Update existing notes container
    const notesContent = notesContainer.querySelector('.notes-content');
    if (noteText) {
      notesContent.textContent = noteText;
      notesContainer.style.display = '';
      // Add brief highlight animation to show the update
      notesContainer.style.background = 'rgba(144, 238, 144, 0.2)';
      setTimeout(() => {
        notesContainer.style.background = '';
        notesContainer.style.transition = 'background 0.3s ease';
      }, 500);
    } else {
      // Remove notes container if note is empty
      notesContainer.style.transition = 'opacity 0.3s ease';
      notesContainer.style.opacity = '0';
      setTimeout(() => {
        if (notesContainer.parentNode) {
          notesContainer.parentNode.removeChild(notesContainer);
        }
      }, 300);
    }
  }
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

// Enhanced CRUD validation and utility functions for note management
function validateNoteData(item, noteText) {
  // Validate item structure
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid item: must be an object');
  }
  
  if (!item.id || typeof item.id !== 'string') {
    throw new Error('Invalid item: missing or invalid ID');
  }
  
  // Validate note text
  if (noteText !== undefined && typeof noteText !== 'string') {
    throw new Error('Invalid note: must be a string');
  }
  
  if (noteText && noteText.length > 2000) {
    throw new Error('Note too long: maximum 2000 characters');
  }
  
  return true;
}

// Function to get the appropriate storage key for an item
function getStorageKeyForItem(item) {
  // Determine storage location based on item properties
  if (item.isHighlight || item.type === 'highlight') {
    return 'savedHighlights';
  } else if (item.type === 'text') {
    return 'savedTextItems';
  } else {
    return 'savedItems';
  }
}

// Function to backup notes before major operations
function backupItemNote(item, callback) {
  if (!item || !item.id) {
    callback(new Error('Invalid item for backup'));
    return;
  }
  
  const backup = {
    itemId: item.id,
    originalNote: item.notes || '',
    timestamp: new Date().toISOString(),
    action: 'backup'
  };
  
  chrome.storage.local.get(['noteBackups'], function(result) {
    const backups = result.noteBackups || [];
    backups.push(backup);
    
    // Keep only last 50 backups to avoid storage bloat
    if (backups.length > 50) {
      backups.splice(0, backups.length - 50);
    }
    
    chrome.storage.local.set({ noteBackups: backups }, function() {
      if (chrome.runtime.lastError) {
        callback(chrome.runtime.lastError);
      } else {
        callback(null, backup);
      }
    });
  });
}

// Enhanced note validation with sanitization
function sanitizeNoteText(noteText) {
  if (!noteText || typeof noteText !== 'string') {
    return '';
  }
  
  // Remove potentially harmful content while preserving user formatting
  return noteText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .trim();
}

// Function to log CRUD operations for debugging
function logCRUDOperation(operation, itemId, details = {}) {
  const logEntry = {
    operation: operation, // 'create', 'read', 'update', 'delete'
    itemId: itemId,
    timestamp: new Date().toISOString(),
    details: details
  };
  
  console.log(`CRUD ${operation.toUpperCase()}:`, logEntry);
  
  // Store in session storage for debugging (cleared on extension reload)
  try {
    const logs = JSON.parse(sessionStorage.getItem('extensionCRUDLogs') || '[]');
    logs.push(logEntry);
    
    // Keep only last 100 log entries
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    
    sessionStorage.setItem('extensionCRUDLogs', JSON.stringify(logs));
  } catch (e) {
    // Silent fail for session storage issues
  }
}
