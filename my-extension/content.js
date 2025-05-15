// Add this to the top of your content.js file to ensure highlights are styled properly
(function() {
  // Add CSS for highlights if it doesn't exist
  if (!document.querySelector('#data-flowx-styles')) {
    const style = document.createElement('style');
    style.id = 'data-flowx-styles';
    style.textContent = `
      .data-flowx-highlight {
        background-color: #ffb6c1;  /* Soft pink - constant for all highlights */
        display: inline;
        border-radius: 2px;
        padding: 0 1px;
        margin: 0 1px;
        cursor: help;
        position: relative;
      }
      
      .data-flowx-highlight:hover {
        opacity: 0.9;
      }
      
      .data-flowx-highlight.fuzzy-match {
        border-bottom: 1px dashed #000;
      }
    `;
    document.head.appendChild(style);
    console.log("Added highlight styles to page");
  }
})();

// Notify the background script that this content script is ready
chrome.runtime.sendMessage({action: "contentScriptReady", url: window.location.href});

console.log("Content script loaded for: " + window.location.href);

// Wait for document to be fully loaded before restoring highlights
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // First attempt at restoration with a short delay
    setTimeout(restoreHighlights, 500);
    
    // Second attempt when page is fully loaded with resources
    window.addEventListener('load', function() {
      setTimeout(restoreHighlights, 300);
    });
  });
} else {
  // If already loaded, restore with a small delay
  setTimeout(restoreHighlights, 500);
  
  // Also try again after a longer delay in case the DOM is still changing
  setTimeout(restoreHighlights, 1500);
}

// Enhanced highlightText function to fix highlighting issues - now with fixed soft pink color
function highlightSelectedText(color, highlightId) {
  // Always use soft pink regardless of input
  const softPinkColor = '#ffb6c1';
  const selection = window.getSelection();
  
  // Check if there's a valid selection
  if (!selection || !selection.rangeCount || selection.toString().trim() === '') {
    console.error("No valid text selection found");
    return { success: false, error: "No text selected" };
  }
  
  try {
    const range = selection.getRangeAt(0);
    
    // Check if range is in editable element - highlighting won't work there
    if (isRangeInEditableElement(range)) {
      return { success: false, error: "Cannot highlight text in form fields" };
    }
    
    // Check if range spans multiple blocks - this can cause DOM exceptions
    if (spansMultipleBlocks(range)) {
      // We need to handle this differently by creating multiple highlights
      return highlightMultipleBlocks(selection, softPinkColor, highlightId);
    }
    
    // Create the highlight span
    const highlightSpan = document.createElement('span');
    highlightSpan.style.backgroundColor = softPinkColor; // Always use soft pink
    highlightSpan.className = 'data-flowx-highlight';
    highlightSpan.dataset.highlightId = highlightId || 'highlight-' + Date.now();
    
    // Try to surround contents with the span
    try {
      range.surroundContents(highlightSpan);
      
      // Add click listener for removing the highlight
      highlightSpan.addEventListener('click', function(event) {
        if (event.ctrlKey || event.metaKey) {
          const textNode = document.createTextNode(highlightSpan.textContent);
          highlightSpan.parentNode.replaceChild(textNode, highlightSpan);
          textNode.parentNode.normalize();
          
          chrome.runtime.sendMessage({
            action: "removeHighlight",
            highlightId: highlightSpan.dataset.highlightId
          });
        }
      });
      
      // Clear the selection
      selection.removeAllRanges();
      return { success: true, highlightId: highlightSpan.dataset.highlightId };
    } catch (e) {
      console.error("surroundContents failed:", e);
      
      // Alternative approach for complex DOM structures
      return highlightWithTextNodes(range, color, highlightId);
    }
  } catch (error) {
    console.error("Error in highlightSelectedText:", error);
    return { success: false, error: error.message || "Unknown highlighting error" };
  }
}

// Helper function to check if range is in an editable element
function isRangeInEditableElement(range) {
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  
  const isEditable = element.closest('input, textarea, [contenteditable="true"]') !== null;
  return isEditable;
}

// Helper function to check if range spans multiple block elements
function spansMultipleBlocks(range) {
  const startNode = range.startContainer;
  const endNode = range.endContainer;
  
  if (startNode === endNode) return false;
  
  const blockTags = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'TABLE'];
  const startBlock = getClosestBlockElement(startNode);
  const endBlock = getClosestBlockElement(endNode);
  
  return startBlock !== endBlock;
  
  function getClosestBlockElement(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    
    while (node && !blockTags.includes(node.tagName)) {
      node = node.parentElement;
    }
    
    return node;
  }
}

// Helper function to highlight text when spans multiple blocks
function highlightMultipleBlocks(selection, color, highlightId) {
  const softPinkColor = '#ffb6c1'; // Always use soft pink
  const baseId = highlightId || 'highlight-' + Date.now();
  let success = false;
  
  try {
    // Create a document fragment to hold our highlighted content
    const fragment = document.createDocumentFragment();
    
    // Get all ranges in the selection
    const range = selection.getRangeAt(0);
    const contents = range.extractContents();
    
    // Process each node in the extracted content
    Array.from(contents.childNodes).forEach((node, index) => {
      const currentId = `${baseId}-${index}`;
      
      if (node.nodeType === Node.TEXT_NODE) {
        // For text nodes, wrap them directly
        const span = document.createElement('span');
        span.style.backgroundColor = softPinkColor; // Always use soft pink
        span.className = 'data-flowx-highlight';
        span.dataset.highlightId = currentId;
        span.textContent = node.textContent;
        fragment.appendChild(span);
      } else {
        // For element nodes, process their text content
        processElementNode(node, softPinkColor, currentId); // Always use soft pink
        fragment.appendChild(node);
      }
    });
    
    // Insert the modified content back
    range.insertNode(fragment);
    success = true;
    
    // Clear selection
    selection.removeAllRanges();
    
    return { success: true, highlightId: baseId };
  } catch (error) {
    console.error("Error in highlightMultipleBlocks:", error);
    return { success: false, error: "Failed to highlight across multiple blocks" };
  }
  
  // Helper function to process element nodes
  function processElementNode(element, color, id) {
    // Find all text nodes within the element
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Process each text node
    textNodes.forEach((textNode, i) => {
      if (textNode.textContent.trim() !== "") {
        const span = document.createElement('span');
        span.style.backgroundColor = '#ffb6c1'; // Always use soft pink
        span.className = 'data-flowx-highlight';
        span.dataset.highlightId = `${id}-sub-${i}`;
        span.textContent = textNode.textContent;
        
        // Replace the text node with our highlighted span
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(span, textNode);
        }
      }
    });
  }
}

// Alternative highlighting method for complex DOM structures
function highlightWithTextNodes(range, color, highlightId) {
  const softPinkColor = '#ffb6c1'; // Always use soft pink
  const baseId = highlightId || 'highlight-' + Date.now();
  try {
    const text = range.toString();
    const span = document.createElement('span');
    span.style.backgroundColor = softPinkColor; // Always use soft pink
    span.className = 'data-flowx-highlight';
    span.dataset.highlightId = baseId;
    span.textContent = text;
    
    // Clear the selected content
    range.deleteContents();
    
    // Insert our highlighted span
    range.insertNode(span);
    
    return { success: true, highlightId: baseId };
  } catch (error) {
    console.error("Error in alternative highlight method:", error);
    return { success: false, error: "Failed to apply highlight alternative" };
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    console.log("Content script received message:", request.action);
    
    // Simple ping-pong for checking if content script is loaded
    if (request.action === "ping") {
      console.log("Ping received in content script");
      sendResponse({status: "ok", url: window.location.href});
      return true;
    }
    else if (request.action === "restoreHighlights") {
      console.log("Restore highlights message received on " + window.location.href);
      // Restore highlights when explicitly requested
      restoreHighlights();
      sendResponse({status: "ok", source: "content.js"});
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
      try {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // Check if there's actually text selected
        if (selectedText) {
          // For text that's already highlighted, check if it's in a highlight span
          let isAlreadyHighlighted = false;
          let existingHighlightColor = null;
          
          // Get the containing node
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          let highlightElement = null;
          
          // Check if selection is within a highlight
          if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
            if (container.parentNode.classList && 
                container.parentNode.classList.contains('data-flowx-highlight')) {
              highlightElement = container.parentNode;
            }
          } else if (container.classList && 
                     container.classList.contains('data-flowx-highlight')) {
            highlightElement = container;
          }
          
          if (highlightElement) {
            isAlreadyHighlighted = true;
            existingHighlightColor = highlightElement.style.backgroundColor;
          }
          
          // Get position of selection for UI feedback
          let position = null;
          if (selection.rangeCount > 0) {
            const rect = range.getBoundingClientRect();
            position = {
              top: rect.top + window.pageYOffset,
              left: rect.left + window.pageXOffset
            };
          }
          
          // Get current page info
          const pageUrl = window.location.href;
          const pageTitle = document.title;
          
          // Send complete response with all necessary data
          sendResponse({
            selectedText: selectedText,
            position: position,
            pageUrl: pageUrl,
            pageTitle: pageTitle,
            isAlreadyHighlighted: isAlreadyHighlighted,
            existingHighlightColor: existingHighlightColor
          });
        } else {
          // No text selected
          sendResponse({
            selectedText: null,
            error: "No text selected"
          });
        }
      } catch (error) {
        console.error("Error getting selected text:", error);
        sendResponse({
          selectedText: null,
          error: "Error processing selection: " + error.message
        });
      }
      
      return true; // Keep the messaging channel open for async response
    } else if (request.action === "highlightText") {
      console.log("Received highlight request");
      const selection = window.getSelection();
      
      if (!selection || !selection.rangeCount || selection.toString().trim() === '') {
        console.log("No valid selection found for highlighting");
        sendResponse({
          success: false,
          error: "No text selected"
        });
        return true;
      }
      
      // Generate a unique highlightId if not provided
      const highlightId = request.highlightId || 'highlight-' + Date.now();
      
      // Always use soft pink color regardless of what was passed
      const softPinkColor = '#ffb6c1';
      
      // Call the highlight function with soft pink color
      const result = highlightSelectedText(softPinkColor, highlightId);
      console.log("Highlight result:", result);
      
      // Send the result back to the popup
      sendResponse(result);
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
    sendResponse({success: false, error: error.message || "Unknown error"});
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
    if (target.classList && target.classList.contains('data-flowx-highlight')) {
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

// Improved function to restore highlights from storage
function restoreHighlights() {
  const currentUrl = window.location.href;
  
  console.log("Attempting to restore highlights for:", currentUrl);
  
  // Get saved highlights from storage
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Filter highlights for this page - with more flexible URL matching
    // We'll use hostname + pathname to match, ignoring query parameters
    const currentUrlObj = new URL(currentUrl);
    const urlToMatch = currentUrlObj.origin + currentUrlObj.pathname;
    
    // Find highlights for this page, including traditional and new format
    const pageHighlights = savedItems.filter(item => {
      if (item.content && item.content.pageUrl) {
        // Try to parse URL for comparison
        try {
          const storedUrlObj = new URL(item.content.pageUrl);
          const storedUrlBase = storedUrlObj.origin + storedUrlObj.pathname;
          
          // Check if this is a highlight (either old or new format)
          const isHighlight = 
            item.type === 'highlight' || 
            (item.type === 'text' && item.content.metadata && item.content.metadata.isHighlight);
          
          return isHighlight && storedUrlBase === urlToMatch;
        } catch (e) {
          // If URL parsing fails, fall back to exact match
          return (item.type === 'highlight' || 
                 (item.type === 'text' && item.content.metadata && item.content.metadata.isHighlight)) && 
                 item.content.pageUrl === currentUrl;
        }
      }
      return false;
    });
    
    if (pageHighlights.length > 0) {
      console.log(`Found ${pageHighlights.length} highlights to restore on this page`);
      
      // Process each highlight with increasing delays to give DOM time to settle
      pageHighlights.forEach((highlight, index) => {
        // Use exponentially increasing delays for better reliability
        const delay = 250 + (index * 150);
        
        setTimeout(() => {
          try {
            // Handle both old and new format highlights
            if (highlight.type === 'highlight' && highlight.content.text && highlight.content.color) {
              applyStoredHighlight(highlight);
            } 
            else if (highlight.type === 'text' && 
                    highlight.content.metadata && 
                    highlight.content.metadata.isHighlight &&
                    highlight.content.text) {
              // Handle new format highlights stored as text type with metadata
              const newFormatHighlight = {
                id: highlight.id,
                content: {
                  text: highlight.content.text,
                  color: highlight.content.metadata.color || '#ffff00',
                  highlightId: highlight.content.metadata.highlightId || highlight.id,
                  pageUrl: highlight.content.pageUrl,
                  pageTitle: highlight.content.pageTitle
                }
              };
              applyStoredHighlight(newFormatHighlight);
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

// Enhanced function to apply a stored highlight to the page
function applyStoredHighlight(highlight) {
  const text = highlight.content.text;
  const color = highlight.content.color;
  const highlightId = highlight.id;
  
  if (!text || text.length === 0) {
    console.log("Empty highlight text, skipping");
    return;
  }
  
  console.log(`Restoring highlight: "${text.substring(0, 20)}..."`, highlightId);
  
  // Find all text nodes in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: node => {
        // Skip very short text nodes and nodes in script/style tags
        if (node.textContent.length < 2) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && 
            (node.parentElement.tagName === 'SCRIPT' || 
             node.parentElement.tagName === 'STYLE' ||
             node.parentElement.tagName === 'NOSCRIPT' ||
             node.parentElement.className.includes('data-flowx-highlight'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.textContent.includes(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  // Process each matching text node
  let node;
  let found = false;
  const matchedNodes = [];
  
  // Collect all matching nodes first
  while (node = walker.nextNode()) {
    matchedNodes.push(node);
  }
  
  // Sort matched nodes by how closely they match the highlight text
  // This helps prioritize exact matches
  matchedNodes.sort((a, b) => {
    const aMatch = a.textContent.indexOf(text);
    const bMatch = b.textContent.indexOf(text);
    
    // If both contain an exact match, prefer the shorter node (more precise context)
    if (aMatch !== -1 && bMatch !== -1) {
      return a.textContent.length - b.textContent.length;
    }
    
    // Otherwise prefer nodes that contain the text
    return aMatch - bMatch;
  });
  
  // Try to restore highlight to each matching node until successful
  for (const node of matchedNodes) {
    const content = node.textContent;
    const index = content.indexOf(text);
    
    if (index >= 0) {
      // Create a range for the matching text
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      
      // Create highlight span with soft pink color
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'data-flowx-highlight';
      highlightSpan.style.backgroundColor = '#ffb6c1'; // Always use soft pink regardless of stored color
      highlightSpan.style.display = 'inline';
      highlightSpan.dataset.highlightId = highlightId;
      highlightSpan.dataset.timestamp = highlight.content.timestamp || new Date().toISOString();
      
      // Apply the highlight
      try {
        range.surroundContents(highlightSpan);
        
        // Make the highlight removable by clicking on it with Ctrl/Cmd
        highlightSpan.addEventListener('click', function(e) {
          if (e.ctrlKey || e.metaKey) {
            // Remove highlight if Ctrl/Cmd is pressed while clicking
            removeHighlight(highlightSpan, highlightId);
          }
        });
        
        // Add right-click context menu for this highlight
        highlightSpan.addEventListener('contextmenu', function(e) {
          chrome.runtime.sendMessage({
            action: "contextMenuOnHighlight",
            highlightId: highlightId
          });
        });
        
        found = true;
        console.log(`Successfully restored highlight: "${text.substring(0, 20)}..."`);
        break; // Stop after first successful highlight
      } catch (e) {
        console.error('Error applying stored highlight:', e);
        // Continue trying with other matching nodes
      }
    }
  }
  
  if (!found) {
    console.log(`Could not find exact text to highlight: "${text.substring(0, 20)}..." - DOM may have changed`);
    
    // Optional: Try fuzzy matching or partial highlighting if exact match fails
    tryFuzzyHighlightMatch(text, color, highlightId);
  }
}

// Helper function to attempt fuzzy matching for highlights
function tryFuzzyHighlightMatch(text, color, highlightId) {
  // Only try fuzzy matching for longer text that's worth the effort
  if (text.length < 20) return false;
  
  // Try to find a paragraph that contains most of the words
  const words = text.split(/\s+/).filter(w => w.length > 3);
  if (words.length < 3) return false;
  
  // Look for paragraphs containing at least 2/3 of the significant words
  const paragraphs = document.querySelectorAll('p');
  let bestMatch = null;
  let maxScore = 0;
  
  paragraphs.forEach(p => {
    if (p.textContent.length < text.length * 0.5) return; // Skip very short paragraphs
    
    let score = 0;
    words.forEach(word => {
      if (p.textContent.includes(word)) score++;
    });
    
    const matchRatio = score / words.length;
    if (matchRatio > 0.5 && matchRatio > maxScore) {
      maxScore = matchRatio;
      bestMatch = p;
    }
  });
  
  if (bestMatch) {
    console.log(`Found fuzzy match with score ${maxScore.toFixed(2)} for highlight`);
    
    // Create highlight span with soft pink
    const span = document.createElement('span');
    span.className = 'data-flowx-highlight fuzzy-match';
    span.style.backgroundColor = '#ffb6c1'; // Always use soft pink
    span.dataset.highlightId = highlightId;
    span.dataset.originalText = text;
    span.title = "This highlight was approximately matched - text may have changed";
    
    // Try to highlight just the matching portion
    const textContent = bestMatch.textContent;
    let startPos = 0;
    let endPos = textContent.length;
    
    // Try to find a substring that contains most of the words
    for (let i = 0; i < words.length; i++) {
      const wordPos = textContent.indexOf(words[i]);
      if (wordPos !== -1) {
        startPos = Math.max(0, wordPos - 20);
        break;
      }
    }
    
    for (let i = words.length - 1; i >= 0; i--) {
      const wordPos = textContent.lastIndexOf(words[i]);
      if (wordPos !== -1) {
        endPos = Math.min(textContent.length, wordPos + words[i].length + 20);
        break;
      }
    }
    
    // Create a text node walker to find the right nodes to highlight
    const walker = document.createTreeWalker(
      bestMatch,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    let currentPos = 0;
    let found = false;
    
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent.length;
      
      // Check if this node contains our target range
      if (currentPos + nodeLength > startPos && currentPos < endPos) {
        // This node contains part of our highlight
        const nodeStartPos = Math.max(0, startPos - currentPos);
        const nodeEndPos = Math.min(nodeLength, endPos - currentPos);
        
        if (nodeStartPos < nodeEndPos) {
          const range = document.createRange();
          range.setStart(node, nodeStartPos);
          range.setEnd(node, nodeEndPos);
          
          try {
            const highlightSpan = span.cloneNode(true);
            range.surroundContents(highlightSpan);
            
            // Make the highlight removable
            highlightSpan.addEventListener('click', function(e) {
              if (e.ctrlKey || e.metaKey) {
                removeHighlight(highlightSpan, highlightId);
              }
            });
            
            found = true;
          } catch (e) {
            console.error('Error applying fuzzy highlight:', e);
          }
        }
      }
      
      currentPos += nodeLength;
    }
    
    return found;
  }
  
  return false;
}

// Helper function to remove a highlight
function removeHighlight(highlightSpan, highlightId) {
  const parent = highlightSpan.parentNode;
  
  // Move all children out of the highlight element
  while (highlightSpan.firstChild) {
    parent.insertBefore(highlightSpan.firstChild, highlightSpan);
  }
  
  // Remove the empty highlight element
  parent.removeChild(highlightSpan);
  
  // Merge adjacent text nodes
  parent.normalize();
  
  // Notify background script to remove from storage
  chrome.runtime.sendMessage({
    action: "removeHighlight",
    highlightId: highlightId
  });
  
  console.log('Highlight removed:', highlightId);
}
