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
});

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
  
  // Get saved items from storage
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Update Delete All button state
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
      if (savedItems.length === 0) {
        deleteAllBtn.disabled = true;
        deleteAllBtn.classList.add('disabled');
      } else {
        deleteAllBtn.disabled = false;
        deleteAllBtn.classList.remove('disabled');
      }
    }
    
    if (savedItems.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No saved items yet';
      container.appendChild(emptyState);
      return;
    }
    
    // Display items in reverse chronological order
    savedItems.reverse().forEach(function(item, index) {
      const originalIndex = savedItems.length - 1 - index;
      const itemElement = document.createElement('div');
      itemElement.className = 'item';
      
      // Create header with date and delete button
      const itemHeader = document.createElement('div');
      itemHeader.className = 'item-header';        const dateElement = document.createElement('div');
      dateElement.className = 'item-date';
      
      // Determine timestamp with fallbacks
      const timestamp = item.timestamp || (item.content && item.content.timestamp) || item.date || null;
      
      // Format date if valid, otherwise use current date
      let dateText;
      try {
        if (timestamp) {
          const dateObj = new Date(timestamp);
          // Check if date is valid
          if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date');
          }
          // Format date as MM/DD/YYYY, HH:MM AM/PM
          dateText = dateObj.toLocaleDateString() + ', ' + dateObj.toLocaleTimeString();
        } else {
          // Use current date if no timestamp
          dateText = new Date().toLocaleDateString() + ', ' + new Date().toLocaleTimeString();
        }
      } catch (e) {
        console.error('Date formatting error:', e);
        dateText = new Date().toLocaleDateString() + ', ' + new Date().toLocaleTimeString();
      }
      
      dateElement.textContent = dateText;
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = '×';
      deleteButton.title = 'Delete this item';
      deleteButton.setAttribute('data-index', originalIndex);        deleteButton.addEventListener('click', function(e) {
        const itemIndex = parseInt(e.target.getAttribute('data-index'));
        if (confirm('Are you sure you want to delete this saved item?')) {
          deleteItem(itemIndex);
        }
      });
      
      itemHeader.appendChild(dateElement);
      itemHeader.appendChild(deleteButton);
      
      const contentElement = document.createElement('div');
        if (item.type === 'text') {
        contentElement.textContent = item.content.text || item.content;
        
        // Check if this is actually a highlight stored as text type (new format)
        const isHighlight = item.content.metadata && item.content.metadata.isHighlight;
        
        if (isHighlight) {
          // Mark this element as a highlight for styling
          contentElement.className = 'highlight-text';
            // Apply soft pink color for all highlights
          contentElement.style.backgroundColor = '#ffb6c1';
          
          // Add the web-relorded information in a prominent way
          const webRelordedInfo = document.createElement('div');
          webRelordedInfo.className = 'web-relorded-info';
          
          // Create highlight info section
          const highlightInfo = document.createElement('div');
          highlightInfo.className = 'highlight-info';
          
          // Create a small color swatch
          const colorSwatch = document.createElement('span');
          colorSwatch.className = 'color-swatch';
          colorSwatch.style.backgroundColor = '#ffb6c1';
          colorSwatch.title = 'Highlight color: Soft Pink';
          
          highlightInfo.appendChild(colorSwatch);
          highlightInfo.appendChild(document.createTextNode(' Highlighted text'));
          
          contentElement.appendChild(highlightInfo);
        }
        
        // Add source info if available - enhanced formatting for highlights
        if (item.content.pageUrl && item.content.pageTitle) {
          const sourceElement = document.createElement('div');
          sourceElement.className = isHighlight ? 'highlight-source' : 'item-source';
          
          // Add webpage favicon if available
          try {
            const faviconUrl = new URL(item.content.pageUrl);
            const faviconElement = document.createElement('img');
            faviconElement.src = `https://www.google.com/s2/favicons?domain=${faviconUrl.hostname}`;
            faviconElement.className = 'source-favicon';
            faviconElement.alt = '';
            sourceElement.appendChild(faviconElement);
          } catch (e) {
            console.log('Could not add favicon');
          }
          
          const sourceLink = document.createElement('a');
          sourceLink.href = item.content.pageUrl;
          sourceLink.textContent = item.content.pageTitle;
          sourceLink.target = '_blank';
          
          // Different label depending on if it's a highlight or regular text
          sourceElement.appendChild(document.createTextNode(isHighlight ? 'Highlighted from: ' : 'Source: '));
          sourceElement.appendChild(sourceLink);
          contentElement.appendChild(sourceElement);
        }      } else if (item.type === 'highlight') {
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-text';
        highlightElement.textContent = item.content.text;
          // Always use soft pink color regardless of what was stored
        highlightElement.style.backgroundColor = '#ffb6c1';
        
        // Add a label indicating if this was originally highlighted on the website
        const highlightInfo = document.createElement('div');
        highlightInfo.className = 'highlight-info';
        
        // Create a small color swatch with soft pink
        const colorSwatch = document.createElement('span');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = '#ffb6c1'; // Always soft pink
        colorSwatch.title = 'Highlight color: Soft Pink';
        
        highlightInfo.appendChild(colorSwatch);
        
        if (item.content.isAlreadyHighlighted) {
          highlightInfo.appendChild(document.createTextNode(' Originally highlighted on website'));
        } else {
          highlightInfo.appendChild(document.createTextNode(' Highlighted by extension'));
        }
        
        contentElement.appendChild(highlightElement);
        contentElement.appendChild(highlightInfo);
        
        // Add source info
        if (item.content.pageUrl && item.content.pageTitle) {
          const sourceElement = document.createElement('div');
          sourceElement.className = 'item-source';
          const sourceLink = document.createElement('a');
          sourceLink.href = item.content.pageUrl;
          sourceLink.textContent = item.content.pageTitle;
          sourceLink.target = '_blank';
          sourceElement.appendChild(document.createTextNode('Highlighted from: '));
          sourceElement.appendChild(sourceLink);
          contentElement.appendChild(sourceElement);
        }
      }
      else if (item.type === 'image') {
        contentElement.className = 'item-image';
        const img = document.createElement('img');
        img.src = item.content;
        contentElement.appendChild(img);
      } 
      else if (item.type === 'article') {
        const link = document.createElement('a');
        link.href = item.content.url;
        link.textContent = item.content.title;
        link.target = '_blank';
        contentElement.appendChild(link);
      }
      
      itemElement.appendChild(itemHeader);
      itemElement.appendChild(contentElement);
      container.appendChild(itemElement);
    });
  });
}

// Function to delete an item
function deleteItem(index) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    if (index >= 0 && index < savedItems.length) {
      // Remove the item at the specified index
      savedItems.splice(index, 1);
      
      // Save the updated array back to storage
      chrome.storage.local.set({savedItems: savedItems}, function() {
        // Reload the items list
        loadSavedItems();
      });
    }
  });
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
    
    // Delete all items
    chrome.storage.local.set({savedItems: []}, function() {
      // Reset button state
      setTimeout(function() {
        // Reload the items list (which will now be empty)
        loadSavedItems();
        deleteAllBtn.textContent = originalText;
        
        // Update notification
        notification.textContent = 'All items deleted successfully!';
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
