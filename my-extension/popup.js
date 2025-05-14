// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {  // Get UI elements
  const saveTextBtn = document.getElementById('saveText');
  const highlightTextBtn = document.getElementById('highlightText');
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
  });  // Unified function to save both normal text and highlighted text
  function saveToStorage(type, content, isHighlighted = false) {
    chrome.storage.local.get(['savedItems'], function(result) {
      const savedItems = result.savedItems || [];
      const timestamp = new Date().toISOString();
      const id = 'item-' + Date.now();
      
      // Check for duplicates before saving
      const isDuplicate = checkForDuplicate(savedItems, type, content);
      
      if (isDuplicate) {
        console.log("Item already exists, not saving duplicate");
        showStatus('Item already saved!');
        return; // Exit without saving
      }
      
      // Unified format for all text content
      savedItems.push({
        id: id,
        type: 'text', // Always use text type for consistency
        timestamp: timestamp,
        date: timestamp, // Keep date field for backwards compatibility
        content: {
          text: content.text,
          pageUrl: content.pageUrl,
          pageTitle: content.pageTitle,
          // Metadata for all text items, with isHighlight flag
          metadata: {
            isHighlight: isHighlighted,
            highlightId: isHighlighted ? (content.highlightId || id) : null,
            color: isHighlighted ? '#ffb6c1' : null
          }
        }
      });
      
      // Update storage
      chrome.storage.local.set({ savedItems: savedItems }, function() {
        console.log(`${type} saved with id: ${id}`);
      });
    });
  }
  // Updated helper function to check for duplicates with unified format
  function checkForDuplicate(savedItems, type, content) {
    // For text items (both normal and highlighted), check if the same text from the same page already exists
    if (type === 'text') {
      return savedItems.some(item => {
        // Check for text items in the unified format
        if (item.type === 'text' && 
            item.content && 
            item.content.text === content.text &&
            item.content.pageUrl === content.pageUrl) {
          return true;
        }
        
        // Check for highlight items (old format for backward compatibility)
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

  // 1. Save Text button functionality
  saveTextBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        showStatus('Unable to access tab', true);
        return;
      }
      
      // Ensure content script is loaded (similar to highlight functionality)
      chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(pingResponse) {
        if (chrome.runtime.lastError) {
          console.log("Content script not loaded, injecting now");
          
          // Inject the content script
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content.js']
          }).then(() => {
            // Wait brief moment for script to initialize
            setTimeout(() => saveTextProcess(tabs[0].id), 100);
          }).catch(err => {
            showStatus("Couldn't access this page", true);
            console.error('Script injection error:', err);
          });
        } else {
          // Content script is already loaded
          saveTextProcess(tabs[0].id);
        }
      });
      
      function saveTextProcess(tabId) {
        try {
          chrome.tabs.sendMessage(tabId, {action: "getSelectedText"}, function(response) {
            if (chrome.runtime.lastError) {
              showStatus('Error accessing page content', true);
              return;
            }
              if (response && response.selectedText) {
              // Successfully got the selected text
              // Use the unified function with isHighlighted = false for normal text
              saveToStorage('text', {
                text: response.selectedText,
                pageUrl: response.pageUrl || tabs[0].url,
                pageTitle: response.pageTitle || tabs[0].title
              }, false);
              showStatus('Text saved!');
            } else {
              // No text selected or error occurred
              const errorMessage = response && response.error ? response.error : 'No text selected!';
              showStatus(errorMessage, true);
            }
          });
        } catch (error) {
          showStatus('Error communicating with page', true);
          console.error('Message error:', error);
        }
      }
    });
  });
    // 2. Highlight Text button functionality - With fixed soft pink color
  highlightTextBtn.addEventListener('click', function() {
    // Always use the soft pink color
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        showStatus('Unable to access tab', true);
        return;
      }
      
      // Ensure content script is loaded
      chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(pingResponse) {
        // Handle potential error if content script isn't loaded
        if (chrome.runtime.lastError) {
          console.log("Content script not loaded, injecting now");
          
          // Inject the content script
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content.js']
          }).then(() => {
            // Wait brief moment for script to initialize
            setTimeout(() => highlightProcess(tabs[0].id), 100);
          }).catch(err => {
            showStatus("Couldn't access this page", true);
            console.error('Script injection error:', err);
          });
        } else {
          // Content script is already loaded
          highlightProcess(tabs[0].id);
        }
      });
      
      function highlightProcess(tabId) {
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
          chrome.tabs.sendMessage(tabId, {            action: "highlightText",
            color: '#ffb6c1' // Soft pink color
          }, function(highlightResponse) {
            if (chrome.runtime.lastError) {
              showStatus('Error highlighting text', true);
              return;
            }
            
            console.log("Highlight response:", highlightResponse);
              if (highlightResponse && highlightResponse.success) {
              // Successfully highlighted, use unified function with isHighlighted = true
              saveToStorage('text', {
                text: selectionResponse.selectedText,
                pageUrl: selectionResponse.pageUrl,
                pageTitle: selectionResponse.pageTitle,
                highlightId: highlightResponse.highlightId,
                timestamp: new Date().toISOString()
              }, true); // Set isHighlighted to true
              showStatus('Text highlighted!');
            } else {
              // Error in highlighting
              const errorMessage = highlightResponse && highlightResponse.error 
                ? highlightResponse.error 
                : 'Unknown error';
              showStatus(`Couldn't highlight: ${errorMessage}`, true);
            }
          });
        });
      }
    });
  });

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
          }
          if (response && response.imageUrl) {
            saveToStorage('image', response.imageUrl);
            showStatus('Image saved!');
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
      }
      
      // Unlike other functions, articles can be saved from any page
      const url = tabs[0].url;
      const title = tabs[0].title;
      saveToStorage('article', {url: url, title: title});
      showStatus('Article saved!');
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