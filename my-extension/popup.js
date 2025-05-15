// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const statusDiv = document.getElementById('status');
  
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // Function to save content to storage
  function saveToStorage(type, content, callback) {
    chrome.storage.local.get(['savedItems'], function(result) {
      const savedItems = result.savedItems || [];
      const timestamp = new Date().toISOString();
      const id = 'item-' + Date.now();
      
      // Check for duplicates before saving
      const isDuplicate = checkForDuplicate(savedItems, type, content);
      
      if (isDuplicate) {
        console.log("Item already exists, not saving duplicate");
        showStatus('Item already saved!');
        if (callback) callback(); // Call the callback even if duplicate
        return; // Exit without saving
      }

      // Standard item saving - no highlighting
      savedItems.push({
        id: id,
        type: type,
        timestamp: timestamp,
        date: timestamp,      // Keep date field for backwards compatibility
        content: content
      });
      
      // Update storage
      chrome.storage.local.set({ savedItems: savedItems }, function() {
        console.log(`${type} saved with id: ${id}`);
        // Execute callback if one was provided
        if (callback) callback();
      });
    });
  }

  // Helper function to check for duplicates
  function checkForDuplicate(savedItems, type, content) {
    // For text items, check if the same text from the same page already exists
    if (type === 'text') {
      return savedItems.some(item => {
        // Check for standard text items
        if (item.type === 'text' && 
            item.content && 
            item.content.text === content.text &&
            item.content.pageUrl === content.pageUrl) {
          return true;
        }
        
        return false;
      });
    }
    
    // For articles, check if the same URL is already saved
    if (type === 'article') {
      return savedItems.some(item => 
        item.type === 'article' && 
        item.content && 
        item.content.url === content.url
      );
    }
    
    return false;
  }

  // Enhancement for status messages
  function showStatus(message, isError = false) {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'status-area';
      
      if (isError) {
        statusDiv.classList.add('error-message');
      } else {
        statusDiv.classList.add('success-message');
      }
      
      // Auto-hide success messages after 3 seconds
      if (!isError) {
        setTimeout(() => {
          statusDiv.textContent = '';
          statusDiv.className = 'status-area';
        }, 3000);
      }
    }
  }

  // Save article functionality if button exists
  const saveArticleBtn = document.getElementById('saveArticle');
  if (saveArticleBtn) {
    saveArticleBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          showStatus('Unable to access the active tab!', true);
          return;
        }
        
        // Articles can be saved from any page
        const url = tabs[0].url;
        const title = tabs[0].title;
        saveToStorage('article', {url: url, title: title}, function() {
          // Show success message and keep popup open
          showStatus('Article saved!');
        });
      });
    });
  }

  // View saved items
  const savedItemsBtn = document.getElementById('savedItems');
  if (savedItemsBtn) {
    savedItemsBtn.addEventListener('click', function() {
      chrome.tabs.create({url: 'saved.html'});
      console.log('Opening saved items page');
    });
  } else {
    console.error('savedItems button not found');
  }
});