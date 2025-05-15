// Add this to the top of your content.js file to ensure highlights are styled properly
console.log("🟢 Content script loading...");

// SPECIAL DEBUG MODE - Add this to troubleshoot highlighting issues
const DEBUG_MODE = true;
function debugLog(message) {
  if (DEBUG_MODE) {
    console.log(`🔍 DEBUG: ${message}`);
  }
}

// SPECIAL FIX: Direct approach for text selection
function captureTextSelection() {
  // Capture any text that's selected on the page
  const selection = window.getSelection();
  if (selection && selection.toString().trim() !== '') {
    const selectedText = selection.toString().trim();
    debugLog(`DIRECT CAPTURE: Selected text: ${selectedText.substring(0, 50)}...`);
    
    // Store in multiple places to ensure it's available to the popup
    // 1. Local storage (synchronous)
    try {
      localStorage.setItem('extensionSelectedText', selectedText);
    } catch (e) {
      console.error("Failed to store in localStorage:", e);
    }
    
    // 2. Chrome storage (asynchronous)
    try {
      chrome.storage.local.set({ 'currentSelectedText': selectedText }, function() {
        debugLog("DIRECT SAVE: Text saved to chrome.storage");
      });
    } catch (e) {
      console.error("Failed to store in chrome.storage:", e);
    }
    
    // 3. Notify background script
    try {
      chrome.runtime.sendMessage({
        action: "saveSelectedText",
        text: selectedText
      }, function(response) {
        debugLog("DIRECT NOTIFY: Background script notified");
      });
    } catch (e) {
      console.error("Failed to notify background script:", e);
    }
    
    return selectedText;
  }
  return "";
}

// Monitor text selection with various events for maximum reliability
document.addEventListener('mouseup', function(e) {
  setTimeout(captureTextSelection, 10); // Small delay to ensure selection is complete
}, true);

document.addEventListener('keyup', function(e) {
  // Capture after keyboard selection (Shift+Arrow keys)
  if (e.shiftKey) {
    setTimeout(captureTextSelection, 10);
  }
}, true);

document.addEventListener('selectionchange', function() {
  // Debounce this frequent event
  clearTimeout(window._selectionChangeTimer);
  window._selectionChangeTimer = setTimeout(captureTextSelection, 250);
});

// Enhanced style injection that makes highlighting more reliable across sites
function ensureHighlightStylesExist() {
  if (!document.querySelector('#data-flowx-styles')) {
    console.log("Adding highlight styles to page");
    const style = document.createElement('style');
    style.id = 'data-flowx-styles';
    style.textContent = `
      .data-flowx-highlight {
        background-color: #90EE90 !important;  /* Light green - with !important */
        display: inline !important;
        border-radius: 2px !important;
        padding: 0 1px !important;
        margin: 0 1px !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      .data-flowx-highlight:hover {
        opacity: 0.9 !important;
      }
    `;
    
    // Try to add to head first (most reliable)
    if (document.head) {
      document.head.appendChild(style);
      console.log("✅ Added highlight styles to head");
    } 
    // If no head, try body
    else if (document.body) {
      document.body.appendChild(style);
      console.log("✅ Added highlight styles to body");
    }
    // Last resort - use document.documentElement
    else {
      document.documentElement.appendChild(style);
      console.log("✅ Added highlight styles to document root");
    }
    
    return true;
  }
  return false;
}

// Add the styles as early as possible
ensureHighlightStylesExist();

// Improved force highlight function with multiple strategies
function forceHighlightText(text, highlightId) {
  console.log("🔴 FORCE HIGHLIGHTING:", text);
  const lightGreenColor = '#90ee90';
  
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { success: false, error: "Invalid text for force highlight" };
  }
  
  // Ensure our styles exist
  ensureHighlightStylesExist();
  
  // Ensure text is trimmed
  const trimmedText = text.trim();
  
  // Try multiple highlighting strategies
  // Strategy 1: Range-based highlighting (most precise)
  let result = rangeBasedHighlight(trimmedText, highlightId);
  if (result.success) {
    console.log("✅ Range-based highlighting successful");
    return result;
  }
  
  // Strategy 2: Container-based highlighting (more robust for complex DOMs)
  result = containerBasedHighlight(trimmedText, highlightId);
  if (result.success) {
    console.log("✅ Container-based highlighting successful");
    return result;
  }
  
  // Strategy 3: Document fragment highlighting (for complex cases)
  result = fragmentBasedHighlight(trimmedText, highlightId);
  if (result.success) {
    console.log("✅ Fragment-based highlighting successful");
    return result;
  }
  
  // If all strategies fail
  console.log("❌ All highlighting strategies failed");
  return { success: false, error: "Text not found or couldn't be highlighted" };
  
  // Strategy 1: Range-based highlighting
  function rangeBasedHighlight(text, id) {
    try {
      console.log("Trying range-based highlighting...");
      
      // Escape special characters for regex search
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedText = escapeRegExp(text);
      
      // Find all text nodes that contain our text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Skip script, style tags and existing highlights
            if (node.parentElement && 
                (node.parentElement.tagName === 'SCRIPT' || 
                 node.parentElement.tagName === 'STYLE' ||
                 node.parentElement.tagName === 'NOSCRIPT' ||
                 node.parentElement.className && 
                 node.parentElement.className.includes('data-flowx-highlight'))) {
              return NodeFilter.FILTER_REJECT;
            }
            return node.textContent.includes(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      // Collect matching nodes
      const matchedNodes = [];
      let currentNode;
      while (currentNode = walker.nextNode()) {
        matchedNodes.push(currentNode);
      }
      
      // Sort by length (prefer shorter containers for more precise matches)
      matchedNodes.sort((a, b) => a.textContent.length - b.textContent.length);
      
      // Try each node
      for (const node of matchedNodes) {
        try {
          const index = node.textContent.indexOf(text);
          if (index >= 0) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + text.length);
            
            // Create highlight span
            const span = document.createElement('span');
            span.className = 'data-flowx-highlight';
            span.style.backgroundColor = lightGreenColor;
            span.dataset.highlightId = id;
            
            // Try to surround with highlight
            range.surroundContents(span);
            
            // Add click handler
            span.addEventListener('click', function(e) {
              if (e.ctrlKey || e.metaKey) {
                const textNode = document.createTextNode(span.textContent);
                span.parentNode.replaceChild(textNode, span);
                textNode.parentNode.normalize();
                
                chrome.runtime.sendMessage({
                  action: "removeHighlight",
                  highlightId: id
                });
              }
            });
            
            return { success: true, highlightId: id };
          }
        } catch (e) {
          console.error("Error in range-based highlight:", e);
          // Continue to next node
        }
      }
      
      return { success: false, error: "Range-based highlight failed" };
    } catch (error) {
      console.error("Error in range-based highlighting:", error);
      return { success: false, error: error.message };
    }
  }
  
  // Strategy 2: Container-based highlighting
  function containerBasedHighlight(text, id) {
    try {
      console.log("Trying container-based highlighting...");
      
      // Escape for regex
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedText = escapeRegExp(text);
      
      // Find suitable containers with our text
      const containers = Array.from(document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th'));
      const matchingContainers = containers.filter(el => 
        el.textContent.includes(text) && 
        !el.classList.contains('data-flowx-highlight')
      );
      
      // Sort by smallest container first
      matchingContainers.sort((a, b) => a.textContent.length - b.textContent.length);
      
      // Try each container
      for (const container of matchingContainers) {
        try {
          // Skip containers with very complex HTML or already highlighted content
          if (container.querySelectorAll('.data-flowx-highlight').length > 0) continue;
          
          // Replace text with highlighted version
          const originalHTML = container.innerHTML;
          const newHTML = originalHTML.replace(
            new RegExp(escapedText, 'g'),
            `<span class="data-flowx-highlight" style="background-color: ${lightGreenColor};" data-highlight-id="${id}">${text}</span>`
          );
          
          // Only apply if we made a change
          if (newHTML !== originalHTML) {
            container.innerHTML = newHTML;
            
            // Add click handlers to all highlights
            container.querySelectorAll(`.data-flowx-highlight[data-highlight-id="${id}"]`).forEach(span => {
              span.addEventListener('click', function(event) {
                if (event.ctrlKey || event.metaKey) {
                  const textNode = document.createTextNode(span.textContent);
                  span.parentNode.replaceChild(textNode, span);
                }
              });
            });
            
            return { success: true, highlightId: id };
          }
        } catch (e) {
          console.error("Error in container-based highlight:", e);
          // Continue to next container
        }
      }
      
      return { success: false, error: "Container-based highlight failed" };
    } catch (error) {
      console.error("Error in container-based highlighting:", error);
      return { success: false, error: error.message };
    }
  }
  
  // Strategy 3: Fragment-based highlighting for complex situations
  function fragmentBasedHighlight(text, id) {
    try {
      console.log("Trying fragment-based highlighting...");
      
      // Create a temporary div to hold the entire document content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = document.body.innerHTML;
      
      // Find text in the temp div
      const tempText = tempDiv.textContent;
      const startIndex = tempText.indexOf(text);
      
      if (startIndex === -1) return { success: false, error: "Text not found in document" };
      
      // Mark found text with a unique ID
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = document.body.innerHTML;
      
      // Use DOMParser to create a document fragment
      const parser = new DOMParser();
      const doc = parser.parseFromString(tempContainer.innerHTML, 'text/html');
      
      // Find all text nodes in the doc
      const walker = document.createTreeWalker(
        doc.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      // Collect text nodes
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() !== '') {
          textNodes.push(node);
        }
      }
      
      // Attempt to locate and highlight the exact node
      for (const node of textNodes) {
        const index = node.textContent.indexOf(text);
        if (index !== -1) {
          try {
            // Create a wrapper element
            const wrapper = document.createElement('span');
            wrapper.className = 'data-flowx-highlight-wrapper';
            
            // Insert highlight directly into the actual document
            // Find the corresponding node in the real document
            const realTextNodes = [];
            const realWalker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            
            let realNode;
            while (realNode = realWalker.nextNode()) {
              if (realNode.textContent.trim() !== '') {
                realTextNodes.push(realNode);
              }
            }
            
            // Find the node with matching text
            const matchingNode = realTextNodes.find(n => n.textContent === node.textContent);
            if (matchingNode) {
              const range = document.createRange();
              range.setStart(matchingNode, index);
              range.setEnd(matchingNode, index + text.length);
              
              // Create highlight span
              const span = document.createElement('span');
              span.className = 'data-flowx-highlight';
              span.style.backgroundColor = lightGreenColor;
              span.dataset.highlightId = id;
              
              try {
                range.surroundContents(span);
                return { success: true, highlightId: id };
              } catch (e) {
                console.error("Failed to insert highlight:", e);
              }
            }
          } catch (e) {
            console.error("Error in fragment highlighting:", e);
          }
        }
      }
      
      return { success: false, error: "Fragment-based highlight failed" };
    } catch (error) {
      console.error("Error in fragment-based highlighting:", error);
      return { success: false, error: error.message };
    }
  }
}

// Add a MutationObserver to handle dynamically loaded content
function setupMutationObserver() {
  if (window._highlightObserver) return; // Don't set up multiple observers
  
  try {
    console.log("Setting up highlight mutation observer");
    const observer = new MutationObserver(function(mutations) {
      // Look for significant DOM changes
      let shouldReapplyStyles = false;
      
      for (const mutation of mutations) {
        // If nodes were added
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            // Only consider element nodes
            if (node.nodeType === Node.ELEMENT_NODE) {
              // If styles are removed, reapply them
              if (!document.querySelector('#data-flowx-styles')) {
                shouldReapplyStyles = true;
              }
              // If a significant part of DOM was added, check for highlight styles
              if (node.querySelectorAll && node.querySelectorAll('*').length > 10) {
                shouldReapplyStyles = true;
              }
            }
          }
        }
        
        // If styles or heads were modified
        if (mutation.target.tagName === 'HEAD' || 
            mutation.target.tagName === 'STYLE' ||
            mutation.target.id === 'data-flowx-styles') {
          shouldReapplyStyles = true;
        }
      }
      
      if (shouldReapplyStyles) {
        ensureHighlightStylesExist();
      }
    });
    
    // Start observing
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    window._highlightObserver = observer;
    console.log("Mutation observer for highlights established");
  } catch (e) {
    console.error("Error setting up mutation observer:", e);
  }
}

// Run observer setup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMutationObserver);
} else {
  setupMutationObserver();
}

// Improved function to restore highlights from storage when page loads
function restoreHighlightsOnPageLoad() {
  const currentUrl = window.location.href;
  console.log("🔄 Attempting to restore highlights for:", currentUrl);
  
  // Get saved highlights from storage
  chrome.storage.local.get(['savedItems'], function(result) {
    if (!result || !result.savedItems || !result.savedItems.length) {
      console.log("No saved items found in storage");
      return;
    }
    
    const savedItems = result.savedItems;
    console.log(`Found ${savedItems.length} total saved items`);
    
    // Filter highlights for this page with more flexible URL matching
    const currentUrlObj = new URL(currentUrl);
    const urlToMatch = currentUrlObj.origin + currentUrlObj.pathname;
    
    console.log("Looking for highlights matching URL base:", urlToMatch);
    
    // Find highlights for this page
    const pageHighlights = savedItems.filter(item => {
      // Skip items without content or pageUrl
      if (!item || !item.content || !item.content.pageUrl) return false;
      
      try {
        // Parse stored URL for comparison
        const storedUrlObj = new URL(item.content.pageUrl);
        const storedUrlBase = storedUrlObj.origin + storedUrlObj.pathname;
        
        // Check if this is a highlight
        const isHighlight = 
          item.type === 'text' || 
          item.type === 'highlight' || 
          (item.content.metadata && item.content.metadata.isHighlight) ||
          item.content.wasHighlighted === true ||
          !!item.content.highlightId;
        
        // Check if URL matches (ignoring query parameters)
        const urlMatches = storedUrlBase === urlToMatch;
        
        if (isHighlight && urlMatches) {
          console.log(`Found highlight to restore: "${item.content.text.substring(0, 30)}..."`);
          return true;
        }
        
        return false;
      } catch (e) {
        console.error("Error parsing URL for highlight:", e);
        // Fallback to exact URL match if parsing fails
        return item.content.pageUrl === currentUrl;
      }
    });
    
    if (pageHighlights.length > 0) {
      console.log(`Found ${pageHighlights.length} highlights to restore on this page`);
      
      // Process each highlight with increasing delays to give DOM time to settle
      pageHighlights.forEach((highlight, index) => {
        // Use exponentially increasing delays for better reliability
        const delay = 500 + (index * 300);
        
        setTimeout(() => {
          try {
            console.log(`Restoring highlight ${index + 1}/${pageHighlights.length}`);
            
            // Ensure we have valid highlight data
            if (!highlight.content || !highlight.content.text) {
              console.error("Invalid highlight data", highlight);
              return;
            }
            
            const highlightId = highlight.id || highlight.content.highlightId || ('highlight-' + Date.now());
            const text = highlight.content.text;
            
            // Try to highlight the text using our best method
            console.log(`Attempting to restore highlight: "${text.substring(0, 30)}..."`);
            const result = forceHighlightText(text, highlightId);
            
            if (result.success) {
              console.log(`Successfully restored highlight ${index + 1}`);
            } else {
              console.log(`Failed to restore highlight ${index + 1}: ${result.error}`);
            }
          } catch (e) {
            console.error("Error restoring highlight:", e);
          }
        }, delay);
      });
    } else {
      console.log("No highlights found for this page");
    }
  });
}

// Setup delayed restoration attempts for when page loads
function setupRestorationOnLoad() {
  console.log("Setting up highlight restoration for page load");
  
  // First try: When DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log("DOM content loaded - attempting first highlight restoration");
      setTimeout(restoreHighlightsOnPageLoad, 500);
    });
  } else {
    // DOM is already loaded
    setTimeout(restoreHighlightsOnPageLoad, 500);
  }
  
  // Second try: When page is fully loaded
  window.addEventListener('load', function() {
    console.log("Window fully loaded - attempting second highlight restoration");
    setTimeout(restoreHighlightsOnPageLoad, 1000);
  });
  
  // Third try: After a longer delay for dynamic content
  setTimeout(function() {
    console.log("Delayed restoration - final attempt");
    restoreHighlightsOnPageLoad();
  }, 3000);
}

// Run the restoration setup immediately
setupRestorationOnLoad();

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    console.log("Content script received message at " + new Date().toISOString() + ":", request.action, request);
    
    // Handle find and highlight text request
    if (request.action === "findAndHighlightText") {
      console.log("DIRECT HIGHLIGHT REQUEST for text:", request.text);
      
      if (!request.text || request.text.trim() === '') {
        console.log("Empty text provided for direct highlighting");
        sendResponse({
          success: false,
          error: "No text provided"
        });
        return true;
      }
      
      // Always use forceHighlightText which is the most reliable method
      const result = forceHighlightText(request.text, request.highlightId || 'highlight-' + Date.now());
      sendResponse(result);
      return true;
    }
    
    // Handle highlight selected text action
    else if (request.action === "highlightSelectedText") {
      console.log("HIGHLIGHT REQUEST:", request);
      console.log("Selection text from request:", request.selectionText);
      
      // If we have selectionText, use it directly with our force method
      if (request.selectionText) {
        console.log("Using direct text highlighting with:", request.selectionText);
        const highlightId = request.highlightId || 'highlight-' + Date.now();
        const result = forceHighlightText(request.selectionText, highlightId);
        sendResponse(result);
      } else {
        // Try with current selection as fallback
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
          const selectedText = selection.toString().trim();
          console.log("Using current window selection:", selectedText);
          const highlightId = request.highlightId || 'highlight-' + Date.now();
          const result = forceHighlightText(selectedText, highlightId);
          sendResponse(result);
        } else {
          sendResponse({ success: false, error: "No text selected" });
        }
      }
      return true;
    }
    
    // Add explicit handler for restore highlights action
    else if (request.action === "restoreHighlights") {
      console.log("Received explicit request to restore highlights");
      restoreHighlightsOnPageLoad();
      sendResponse({success: true});
      return true;
    }
    
    // Handle other messages...
    // ... existing code ...

  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({success: false, error: error.message || "Unknown error"});
    return true;
  }
  
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// IMPORTANT: Notify that content script is fully loaded and ready
console.log("✅ Content script fully loaded for: " + window.location.href);
chrome.runtime.sendMessage({
  action: "contentScriptReady", 
  url: window.location.href,
  timestamp: new Date().toISOString()
});

// Add a visible indicator that the extension is active (helps with debugging)
setTimeout(() => {
  try {
    const indicator = document.createElement('div');
    indicator.textContent = '🟢';
    indicator.title = 'Highlight Extension Active';
    indicator.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:10000;opacity:0.7;font-size:18px;';
    document.body.appendChild(indicator);
    
    // Make it fade out after 5 seconds
    setTimeout(() => {
      indicator.style.transition = 'opacity 1s';
      indicator.style.opacity = '0';
      // Remove after fade out
      setTimeout(() => indicator.remove(), 1000);
    }, 5000);
  } catch (e) {
    // Ignore errors
  }
}, 1000);
