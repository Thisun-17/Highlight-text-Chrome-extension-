// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString();
      const selection = window.getSelection();
      let pageUrl = window.location.href;
      
      // Get selection position information if there''s text selected
      let position = null;
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
        } catch (e) {
          console.error('Error getting selection position:', e);
        }
      }
      
      sendResponse({
        selectedText: selectedText,
        position: position,
        pageUrl: pageUrl,
        pageTitle: document.title
      });
    } else if (request.action === "highlightText") {
      const result = highlightSelectedText(request.color || '#ffff00');
      sendResponse(result);
    } else if (request.action === "getImage") {
      // Get image that''s currently focused or under cursor
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
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({error: true, message: error.message});
  }
  
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// Add right-click context menu
document.addEventListener(''contextmenu'', function(event) {
  // You could add custom logic here if needed
});

// Function to highlight the currently selected text
function highlightSelectedText(color) {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return { success: false, message: ''No text selected'' };
  }
  
  const range = selection.getRangeAt(0);
  const highlightSpan = document.createElement(''span'');
  highlightSpan.className = ''extension-highlighted-text'';
  highlightSpan.style.backgroundColor = color;
  highlightSpan.style.display = ''inline'';
  
  try {
    range.surroundContents(highlightSpan);
    
    // Add data attributes to store highlight information
    const highlightId = ''highlight-'' + Date.now();
    highlightSpan.dataset.highlightId = highlightId;
    highlightSpan.dataset.date = new Date().toISOString();
    
    // Make the highlight removable by clicking on it
    highlightSpan.addEventListener(''click'', function(e) {
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
      color: color
    };
  } catch (e) {
    console.error(''Cannot highlight text:'', e);
    return {
      success: false,
      message: e.message
    };
  }
}
