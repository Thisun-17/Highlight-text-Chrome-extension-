// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {  // Get UI elements
  const saveTextBtn = document.getElementById('saveText');
  const saveImageBtn = document.getElementById('saveImage');
  const saveArticleBtn = document.getElementById('saveArticle');
  const statusDiv = document.getElementById('status');
  
  // Set the soft pink color for highlighting
  const SOFT_PINK_COLOR = '#ffb6c1';
  
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
  });  // Update this function to prevent duplicate saving and support callback
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
        // If it's a highlight, standardize it to look like regular text
      if (type === 'highlight') {
        // Keep track of highlight attributes for restoration, but simplify display
        savedItems.push({
          id: id,
          type: 'text', // Change type to 'text' for consistent UI
          timestamp: timestamp, // Use consistent timestamp at root level
          date: timestamp,      // Keep date field for backwards compatibility
          content: {
            text: content.text,
            pageUrl: content.pageUrl,
            pageTitle: content.pageTitle,
            // Store highlight-specific properties in metadata
            metadata: {
              isHighlight: true,
              highlightId: content.highlightId,
              color: content.color
            }
          }
        });
      } else {
        // Standard item saving
        savedItems.push({
          id: id,
          type: type,
          timestamp: timestamp, // Use consistent timestamp at root level
          date: timestamp,      // Keep date field for backwards compatibility
          content: content
        });
      }
        // Update storage
      chrome.storage.local.set({ savedItems: savedItems }, function() {
        console.log(`${type} saved with id: ${id}`);
        // Execute callback if one was provided
        if (callback) callback();
      });
    });
  }

  // Add this helper function to check for duplicates
  function checkForDuplicate(savedItems, type, content) {
    // For text and highlight items, check if the same text from the same page already exists
    if (type === 'text' || type === 'highlight') {
      return savedItems.some(item => {
        // Check for standard text items
        if (item.type === 'text' && 
            item.content && 
            item.content.text === content.text &&
            item.content.pageUrl === content.pageUrl) {
          return true;
        }
        
        // Check for highlight items (old format)
        if (item.type === 'highlight' && 
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
    
    // For images, check if the same image URL is already saved
    if (type === 'image') {
      return savedItems.some(item => 
        item.type === 'image' && 
        item.content === content
      );
    }
    
    return false;
  }

  // Enhancement for status messages
  function showStatus(message, isError = false) {
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

  // Save and Highlight Text button functionality
  saveTextBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        showStatus('Unable to access tab', true);
        return;
      }
      
      // Ensure content script is loaded
      chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(pingResponse) {
        if (chrome.runtime.lastError) {
          console.log("Content script not loaded, injecting now");
          
          // Inject the content script
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content.js']
          }).then(() => {
            // Wait brief moment for script to initialize
            setTimeout(() => saveAndHighlightProcess(tabs[0].id), 100);
          }).catch(err => {
            showStatus("Couldn't access this page", true);
            console.error('Script injection error:', err);
          });
        } else {
          // Content script is already loaded
          saveAndHighlightProcess(tabs[0].id);
        }
      });
      
      function saveAndHighlightProcess(tabId) {
        try {
          // First get selected text
          chrome.tabs.sendMessage(tabId, {action: "getSelectedText"}, function(selectionResponse) {
            if (chrome.runtime.lastError) {
              showStatus('Error accessing page content', true);
              return;
            }
            
            if (!selectionResponse || !selectionResponse.selectedText) {
              showStatus('No text selected!', true);
              return;
            }
            
            // Now send highlight command with soft pink color
            chrome.tabs.sendMessage(tabId, {
              action: "highlightText",
              color: SOFT_PINK_COLOR
            }, function(highlightResponse) {
              if (chrome.runtime.lastError) {
                showStatus('Error highlighting text', true);
                return;
              }
                if (highlightResponse && highlightResponse.success) {
                // Successfully highlighted, save to storage and show success message
                saveToStorage('highlight', {
                  text: selectionResponse.selectedText,
                  color: SOFT_PINK_COLOR,
                  pageUrl: selectionResponse.pageUrl || tabs[0].url,
                  pageTitle: selectionResponse.pageTitle || tabs[0].title,
                  highlightId: highlightResponse.highlightId,
                  timestamp: new Date().toISOString()
                }, function() {
                  showStatus('Text saved and highlighted!');
                  // Don't automatically close the popup to allow the user to continue working
                });
              } else {
                // Error in highlighting
                const errorMessage = highlightResponse && highlightResponse.error 
                  ? highlightResponse.error 
                  : 'Unknown error';
                showStatus(`Couldn't highlight: ${errorMessage}`, true);
              }
            });
          });
        } catch (error) {
          showStatus('Error processing text', true);
          console.error('Message error:', error);
        }
      }
    });  });

  // Save current image
  saveImageBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        showStatus('Unable to access the active tab!', true);
        return;
      }
      
      // Check if we can access this tab
      const url = new URL(tabs[0].url);
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
          url.protocol === 'about:' || url.protocol === 'edge:') {
        // Special handling for restricted pages
        showStatus('Cannot access this page. Try a regular webpage instead.', true);
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getImage"}, function(response) {
          if (chrome.runtime.lastError) {
            showStatus('Extension cannot access this page. Please try another webpage.', true);
            return;
          }          if (response && response.imageUrl) {
            saveToStorage('image', response.imageUrl, function() {
              // Show success message and keep popup open
              showStatus('Image saved!');
            });
          } else {
            showStatus('No image found!', true);
          }
        });
      } catch (error) {
        showStatus('Error communicating with page', true);
        console.error('Message error:', error);
      }
    });
  });

  // Save article
  saveArticleBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        showStatus('Unable to access the active tab!', true);
        return;
      }        // Unlike other functions, articles can be saved from any page
      const url = tabs[0].url;
      const title = tabs[0].title;
      saveToStorage('article', {url: url, title: title}, function() {
        // Show success message and keep popup open
        showStatus('Article saved!');
      });
    });
  });

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