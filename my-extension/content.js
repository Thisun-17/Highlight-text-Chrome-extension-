// Notify the background script that this content script is ready
chrome.runtime.sendMessage({action: "contentScriptReady", url: window.location.href});

console.log("Content script loaded for: " + window.location.href);

// Wait for document to be fully loaded before restoring highlights
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(restoreHighlights, 500); // Small delay to ensure DOM is fully processed
  });
} else {
  // If already loaded, restore with a small delay
  setTimeout(restoreHighlights, 500);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    // Simple ping-pong for checking if content script is loaded
    if (request.action === "ping") {
      console.log("Ping received in content script");
      sendResponse({status: "ok", url: window.location.href});
      return true;
    }
    else if (request.action === "restoreHighlights") {
      // Restore highlights when explicitly requested
      restoreHighlights();
      sendResponse({status: "ok"});
      return true;
    }
    else if (request.action === "removeHighlightById") {
      // Handle remote removal of a highlight by ID
      const highlightId = request.highlightId;
      if (highlightId) {
        const highlightEl = document.querySelector(`[data-highlight-id="${highlightId}"]`);
        if (highlightEl) {
          const parent = highlightEl.parentNode;
          // Move all children out of the highlight element
          while (highlightEl.firstChild) {
            parent.insertBefore(highlightEl.firstChild, highlightEl);
          }
          // Remove the empty highlight element
          parent.removeChild(highlightEl);
          sendResponse({success: true});
        } else {
          sendResponse({success: false, message: 'Highlight element not found'});
        }
      }
      return true;
    }
    else if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString();
      const selection = window.getSelection();
      let pageUrl = window.location.href;
      
      // Get selection position information if there's text selected
      let position = null;
      let existingHighlightColor = null;
      let isAlreadyHighlighted = false;
      
      if (selectedText && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          position = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          };
          
          // Check if the selection is already inside a highlighted element
          const parentElement = range.commonAncestorContainer.parentElement;
          if (parentElement && (
              parentElement.classList.contains('extension-highlighted-text') || 
              parentElement.style && parentElement.style.backgroundColor)) {
            isAlreadyHighlighted = true;
            existingHighlightColor = parentElement.style.backgroundColor || '#ffff00';
            console.log('Selected text is already highlighted with color:', existingHighlightColor);
          }
          
        } catch (e) {
          console.error('Error getting selection position:', e);
        }
      }
      
      sendResponse({
        selectedText: selectedText,
        position: position,
        pageUrl: pageUrl,
        pageTitle: document.title,
        isAlreadyHighlighted: isAlreadyHighlighted,
        existingHighlightColor: existingHighlightColor
      });
      return true; // Keep the messaging channel open for async response
    } else if (request.action === "highlightText") {
      const result = highlightSelectedText(request.color || '#ffff00');
      sendResponse(result);
      return true; // Keep the messaging channel open
    } else if (request.action === "getImage") {
      // Get image that's currently focused or under cursor
      const images = document.querySelectorAll('img');
      let imageUrl = null;
      
      // Just get the first large enough image as an example
      for (let img of images) {
        if (img.width > 100 && img.height > 100) {
          imageUrl = img.src;
          break;
        }
      }
      
      sendResponse({imageUrl: imageUrl});
      return true; // Keep the messaging channel open
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({error: true, message: error.message});
    return true; // Keep the messaging channel open even for errors
  }
  
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// Add right-click context menu
document.addEventListener('contextmenu', function(event) {
  // Check if right-click is on a highlighted element
  let target = event.target;
  
  // Find if the target or any parent is a highlight
  while (target && target !== document.body) {
    if (target.classList && target.classList.contains('extension-highlighted-text')) {
      // Store the highlight element ID in a variable for later use
      const highlightId = target.dataset.highlightId;
      if (highlightId) {
        chrome.runtime.sendMessage({
          action: "contextMenuOnHighlight",
          highlightId: highlightId
        });
      }
      break;
    }
    target = target.parentElement;
  }
});

// Function to restore highlights from storage
function restoreHighlights() {
  const currentUrl = window.location.href;
  
  // Get saved highlights from storage
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Filter highlights for this page
    const pageHighlights = savedItems.filter(item => 
      item.type === 'highlight' && 
      item.content && 
      item.content.pageUrl === currentUrl
    );
    
    if (pageHighlights.length > 0) {
      console.log(`Restoring ${pageHighlights.length} highlights on this page`);
      
      // Process each highlight
      pageHighlights.forEach(highlight => {
        if (highlight.content.text && highlight.content.color) {
          applyStoredHighlight(highlight);
        }
      });
    }
  });
}

// Function to apply a stored highlight to the page
function applyStoredHighlight(highlight) {
  const text = highlight.content.text;
  const color = highlight.content.color;
  const highlightId = highlight.id;
  
  if (!text || text.length === 0) return;
  
  // Find all text nodes in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: node => node.textContent.includes(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
  );
  
  // Process each matching text node
  let node;
  let found = false;
  while (node = walker.nextNode()) {
    const content = node.textContent;
    const index = content.indexOf(text);
    
    if (index >= 0) {
      // Create a range for the matching text
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      
      // Create highlight span
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'extension-highlighted-text';
      highlightSpan.style.backgroundColor = color;
      highlightSpan.style.display = 'inline';
      highlightSpan.dataset.highlightId = highlightId;
      highlightSpan.dataset.date = highlight.date || new Date().toISOString();
      
      // Apply the highlight
      try {
        range.surroundContents(highlightSpan);
        
        // Make the highlight removable by clicking on it
        highlightSpan.addEventListener('click', function(e) {
          if (e.ctrlKey || e.metaKey) {
            // Remove highlight if Ctrl/Cmd is pressed while clicking
            const parent = highlightSpan.parentNode;
            while (highlightSpan.firstChild) {
              parent.insertBefore(highlightSpan.firstChild, highlightSpan);
            }
            parent.removeChild(highlightSpan);
            
            // Notify background script to remove from storage
            chrome.runtime.sendMessage({
              action: "removeHighlight",
              highlightId: highlightId
            });
          }
        });
        
        found = true;
        break; // Stop after first match to avoid multiple highlights
      } catch (e) {
        console.error('Error applying stored highlight:', e);
      }
    }
  }
  
  if (!found) {
    console.log(`Could not find text to highlight: "${text.substring(0, 20)}..."`);
  }
}

// Function to highlight the currently selected text
function highlightSelectedText(color) {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return { success: false, message: 'No text selected' };
  }
  
  const range = selection.getRangeAt(0);
  const highlightSpan = document.createElement('span');
  highlightSpan.className = 'extension-highlighted-text';
  highlightSpan.style.backgroundColor = color;
  highlightSpan.style.display = 'inline';
  
  try {
    range.surroundContents(highlightSpan);
    
    // Add data attributes to store highlight information
    const highlightId = 'highlight-' + Date.now();
    const currentDate = new Date().toISOString();
    highlightSpan.dataset.highlightId = highlightId;
    highlightSpan.dataset.date = currentDate;
    highlightSpan.dataset.pageUrl = window.location.href;
    
    // Make the highlight removable by clicking on it
    highlightSpan.addEventListener('click', function(e) {
      if (e.ctrlKey || e.metaKey) {
        // Remove highlight if Ctrl/Cmd is pressed while clicking
        const parent = highlightSpan.parentNode;
        while (highlightSpan.firstChild) {
          parent.insertBefore(highlightSpan.firstChild, highlightSpan);
        }
        parent.removeChild(highlightSpan);
        
        // Notify background script to remove from storage
        chrome.runtime.sendMessage({
          action: "removeHighlight",
          highlightId: highlightId
        });
      }
    });
    
    // Return highlight information
    return {
      success: true,
      highlightId: highlightId,
      text: highlightSpan.textContent,
      color: color,
      date: currentDate
    };
  } catch (e) {
    console.error('Cannot highlight text:', e);
    return {
      success: false,
      message: e.message
    };
  }
}

// Update the status message in popup.js for saveTextBtn
chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
  if (response && response.selectedText) {
    saveToStorage('text', {
      text: response.selectedText,
      pageUrl: response.pageUrl,
      pageTitle: response.pageTitle
    });
    statusDiv.textContent = 'Text saved!';
  } else {
    statusDiv.textContent = 'No text selected!';
  }
});

// Update the status message in popup.js for highlightTextBtn
if (highlightResponse && highlightResponse.success) {
  saveToStorage('highlight', {
    text: selectionResponse.selectedText,
    color: highlightColor,
    pageUrl: selectionResponse.pageUrl,
    pageTitle: selectionResponse.pageTitle,
    highlightId: highlightResponse.highlightId
  });
  statusDiv.textContent = 'Text highlighted!';
} else {
  statusDiv.textContent = 'Error highlighting text';
}

// Update the status message in popup.js for saveImageBtn
if (response && response.imageUrl) {
  saveToStorage('image', response.imageUrl);
  statusDiv.textContent = 'Image saved!';
} else {
  statusDiv.textContent = 'No image found!';
}

// Update the status message in popup.js for saveArticleBtn
saveToStorage('article', {url: url, title: title});
statusDiv.textContent = 'Article saved!';

// Add this to your popup.js file
document.addEventListener('DOMContentLoaded', function() {
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
  
  // Your existing code for buttons goes here...
  
  // Enhancement for status messages
  function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
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
  
  // You can use this function in your existing code:
  // showStatus('Text saved!');
  // showStatus('No text selected!', true);
});
