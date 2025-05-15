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
      
      // Add event listener to the delete button for this card
      const deleteBtn = itemElement.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
          // Pass the item ID and type to the deleteItem function
          deleteItem(item.id, item.type);
        });
      }
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
  
  card.appendChild(cardContent);
  
  // Create card actions
  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';
  
  // Add delete button
  const deleteButton = document.createElement('button');
  deleteButton.className = 'card-action-btn delete-btn';
  deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
  deleteButton.title = 'Delete this item';
  deleteButton.dataset.id = item.id;
    // Add share button
  const shareButton = document.createElement('button');
  shareButton.className = 'card-action-btn share-btn';
  shareButton.innerHTML = '<i class="fas fa-share-alt"></i>';
  shareButton.title = 'Share this item';
  shareButton.addEventListener('click', function() {
    shareItem(item);
  });
  
  cardActions.appendChild(shareButton);
  cardActions.appendChild(deleteButton);
  card.appendChild(cardActions);
  
  return card;
}

// Function to delete an item
function deleteItem(id, type) {
  // Based on the item type and id, determine which storage to update
  if (type === 'highlight') {
    // Delete from highlights storage
    chrome.storage.local.get(['savedHighlights'], function(result) {
      const items = result.savedHighlights || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedHighlights: newItems}, function() {
        loadSavedItems();
      });
    });
  } else if (type === 'text') {
    // Delete from text-only storage
    chrome.storage.local.get(['savedTextItems'], function(result) {
      const items = result.savedTextItems || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedTextItems: newItems}, function() {
        loadSavedItems();
      });
    });
  } else {
    // Handle legacy items
    chrome.storage.local.get(['savedItems'], function(result) {
      const items = result.savedItems || [];
      const newItems = items.filter(item => item.id !== id);
      chrome.storage.local.set({savedItems: newItems}, function() {
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
