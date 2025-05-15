// Code for handling saved items display
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing saved items view');
  
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
  
  // Add global click handler for delete buttons
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.card-delete-btn');
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      
      const id = target.getAttribute('data-id');
      const type = target.getAttribute('data-type');
      
      console.log(`Delete button clicked for item: ${id} (${type})`);
      
      if (confirm('Are you sure you want to delete this item?')) {
        deleteItemFromStorage(id, type);
      }
    }
  });
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
  console.log('Loading saved items...');
  
  const container = document.getElementById('items-container');
  if (!container) {
    console.error('Container not found!');
    return;
  }
  
  // Clear the container first
  container.innerHTML = '';
  
  // Use our unified function to load all content
  loadAllSavedContent().then(allItems => {
    console.log(`Found ${allItems.length} items to display`);
    
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
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = item.id;
      card.dataset.type = item.type || 'text';
      
      if (item.isHighlight || item.type === 'highlight') {
        card.dataset.isHighlight = "true";
      }
      
      // Add HTML content
      card.innerHTML = `
        <div class="card-header">
          <button class="card-delete-btn" data-id="${item.id}" data-type="${item.type || 'text'}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="card-content">
          <p class="${(item.isHighlight || item.type === 'highlight') ? 'highlight-text' : ''}">
            ${item.text}
          </p>
          ${(item.notes || (item.content && item.content.notes)) ? 
            `<div class="item-notes">
              <span class="notes-label">Note: </span>
              <span class="notes-content">${item.notes || item.content.notes}</span>
            </div>` : 
            ''
          }
          ${(item.pageUrl || item.url) && (item.pageTitle || item.title) ? 
            `<div class="source">
              ${(item.isHighlight || item.type === 'highlight') ? 'Highlighted from: ' : ''}
              <a href="${item.pageUrl || item.url}" target="_blank">
                ${item.pageTitle || item.title}
              </a>
            </div>` : 
            ''
          }
        </div>
      `;
      
      // Apply highlight styling if needed
      if (item.isHighlight || item.type === 'highlight') {
        const highlightText = card.querySelector('p');
        if (highlightText) {
          highlightText.style.backgroundColor = 'var(--highlight-bg)';
        }
      }
      
      container.appendChild(card);
    });
  }).catch(error => {
    console.error('Error loading saved content:', error);
    
    // Show error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'empty-state error';
    errorMsg.textContent = 'Error loading saved items. Please try again.';
    container.appendChild(errorMsg);
  });
}

// Direct function to delete an item from storage
function deleteItemFromStorage(id, type) {
  console.log(`Deleting item ${id} of type ${type} from storage`);
  
  // Based on the item type and id, determine which storage to update
  if (type === 'highlight') {
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const items = result.savedHighlights || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedHighlights: newItems}, function() {
        console.log(`Item ${id} deleted from savedHighlights`);
        
        // Show a notification
        showNotification('Item deleted successfully', 'success');
        
        // Reload the items list
        loadSavedItems(); 
      });
    });
  } else if (type === 'text') {
    chrome.storage.local.get(['savedTextItems'], function(result) {
      const items = result.savedTextItems || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedTextItems: newItems}, function() {
        console.log(`Item ${id} deleted from savedTextItems`);
        
        // Show a notification
        showNotification('Item deleted successfully', 'success');
        
        // Reload the items list
        loadSavedItems();
      });
    });
  } else {
    // Handle legacy items
    chrome.storage.local.get(['savedItems'], function(result) {
      const items = result.savedItems || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedItems: newItems}, function() {
        console.log(`Item ${id} deleted from savedItems`);
        
        // Show a notification
        showNotification('Item deleted successfully', 'success');
        
        // Reload the items list
        loadSavedItems();
      });
    });
  }
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
    showNotification('Deleting all items...', 'info');
    
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
        showNotification('All highlights and saved text deleted!', 'success');
      }, 500); // Small delay for visual feedback
    });
  }
}

// Helper function to show notifications
function showNotification(message, type = '') {
  const notification = document.createElement('div');
  notification.className = 'notification';
  if (type) notification.classList.add(type);
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove notification after 2 seconds
  setTimeout(function() {
    notification.classList.add('fade-out');
    setTimeout(function() {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}
