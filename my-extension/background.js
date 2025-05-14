// Set up context menu items when extension is installed
chrome.runtime.onInstalled.addListener(function() {
  console.log("Content Saver extension installed/updated");

  chrome.contextMenus.create({
    id: "saveText",
    title: "Save Selected Text",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "highlightText",
    title: "Highlight Selected Text",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "saveImage",
    title: "Save This Image",
    contexts: ["image"]
  });
  
  chrome.contextMenus.create({
    id: "saveArticle",
    title: "Save This Article",
    contexts: ["page"]
  });
  
  // Create a context menu item for removing highlights (hidden by default)
  chrome.contextMenus.create({
    id: "removeHighlight",
    title: "Remove Highlight",
    contexts: ["all"],
    visible: false
  });
    // Set soft pink as the only highlight color
  chrome.storage.local.set({highlightColor: '#ffb6c1'});
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {  if (info.menuItemId === "saveText" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {action: "getSelectedText"}, function(response) {
      if (response) {
        saveToStorage('text', {
          text: info.selectionText,
          pageUrl: tab.url,
          pageTitle: tab.title
        });
      }
    });
  }   else if (info.menuItemId === "highlightText" && info.selectionText) {
    // Always use soft pink color
    const softPinkColor = '#ffb6c1';
    chrome.tabs.sendMessage(tab.id, {action: "highlightText", color: softPinkColor}, function(response) {
      if (response && response.success) {
        // Use the unified format with text type
        saveToStorage('text', {
          text: info.selectionText,
          pageUrl: tab.url,
          pageTitle: tab.title,
          highlightId: response.highlightId,
          metadata: {
            isHighlight: true,
            color: softPinkColor
          }
        });
      }
    });
  }  else if (info.menuItemId === "saveImage" && info.srcUrl) {
    saveToStorage('image', info.srcUrl);
  }
  else if (info.menuItemId === "saveArticle") {
    saveToStorage('article', {url: tab.url, title: tab.title});
  }
  else if (info.menuItemId === "removeHighlight" && activeHighlightId) {
    // Remove the highlight from the page and storage
    chrome.tabs.sendMessage(tab.id, {
      action: "removeHighlightById", 
      highlightId: activeHighlightId
    });
    
    // Remove from storage
    removeHighlightFromStorage(activeHighlightId);
    
    // Reset active highlight ID and hide context menu
    activeHighlightId = null;
    chrome.contextMenus.update("removeHighlight", {
      visible: false
    });
  }
});

// Store the currently active highlight ID for context menu
let activeHighlightId = null;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "removeHighlight" && request.highlightId) {
    removeHighlightFromStorage(request.highlightId);
  } else if (request.action === "contentScriptReady") {
    console.log("Content script is ready on tab:", sender.tab.id);
    // Send a message to trigger highlight restoration
    // Use a timeout to ensure the DOM is fully loaded
    setTimeout(() => {
      chrome.tabs.sendMessage(sender.tab.id, {action: "restoreHighlights"}, function(response) {
        console.log("Restore highlights message sent to tab:", sender.tab.id);
        // Handle any response if needed
      });
    }, 500);
  } else if (request.action === "contextMenuOnHighlight") {
    // Show the remove highlight context menu and store the highlight ID
    activeHighlightId = request.highlightId;
    
    // Update the remove highlight context menu item to be visible
    chrome.contextMenus.update("removeHighlight", {
      visible: true
    });
  }
});

// Listen for tab updates to handle page refreshes and navigation
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only act when the tab has completed loading
  if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
    console.log("Tab updated and loaded:", tabId, tab.url);
    
    // Give the content script a moment to initialize before sending the restore message
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {action: "restoreHighlights"}, function(response) {
        // If there's an error, the content script may not be loaded yet
        if (chrome.runtime.lastError) {
          console.log("Content script not ready, injecting now");
          
          // Inject the content script manually
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
          }).then(() => {
            // Wait a moment for the script to initialize, then restore highlights
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {action: "restoreHighlights"});
            }, 300);
          }).catch(err => {
            console.error("Failed to inject content script:", err);
          });
        }
      });
    }, 500);
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle content script ready notification
  if (message.action === "contentScriptReady") {
    console.log("Content script is ready on:", message.url);
    return true;
  }
  
  // Handle highlight removal
  if (message.action === "removeHighlight" && message.highlightId) {
    removeHighlightFromStorage(message.highlightId);
    return true;
  }
});

// Helper function to save to Chrome storage
function saveToStorage(type, content) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Check if this content already exists in the last few minutes
    const textContent = content.text || (typeof content === 'string' ? content : (content.url || ''));
    const recentTime = new Date();
    recentTime.setMinutes(recentTime.getMinutes() - 1); // Look back 1 minute
    
    // Look for duplicates in recent items
    const recentItemWithSameContent = savedItems.find(item => {
      // Check if item was saved within the last minute
      const itemDate = new Date(item.date);
      if (itemDate < recentTime) return false;
      
      // Check if content is the same
      const itemContent = item.content.text || (typeof item.content === 'string' ? item.content : (item.content.url || ''));
      return textContent === itemContent;
    });
    
    // If a recent item with same content exists, don't save
    if (recentItemWithSameContent) {
      console.log('Item with same content was recently saved. Skipping duplicate.');
      return;
    }
      // Create the new item with unified format
    const timestamp = new Date().toISOString();
    const id = content.highlightId || ('item-' + Date.now());
    
    // Determine if this is a highlight
    const isHighlight = type === 'highlight';
    
    const item = {
      id: id,
      type: 'text', // Always use text type for consistency
      timestamp: timestamp,
      date: timestamp, // Keep for backwards compatibility
      content: type === 'text' || type === 'highlight' ? {
        text: content.text,
        pageUrl: content.pageUrl,
        pageTitle: content.pageTitle,
        metadata: {
          isHighlight: isHighlight,
          highlightId: isHighlight ? (content.highlightId || id) : null,
          color: isHighlight ? '#ffb6c1' : null
        }
      } : content
    };
    
    savedItems.push(item);
    chrome.storage.local.set({savedItems: savedItems});
  });
}

// Helper function to remove a highlight from storage
function removeHighlightFromStorage(highlightId) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Find the index of the highlight with the unified format
    const index = savedItems.findIndex(item => 
      // Check both old format and new unified format
      (item.type === 'highlight' && 
       (item.content?.highlightId === highlightId || item.id === highlightId)) ||
      // Check for our new unified format with metadata
      (item.type === 'text' && 
       item.content?.metadata?.isHighlight === true &&
       (item.content?.metadata?.highlightId === highlightId || item.id === highlightId))
    );
    
    if (index !== -1) {
      // Remove the highlight
      savedItems.splice(index, 1);
      
      // Update storage
      chrome.storage.local.set({savedItems: savedItems}, function() {
        console.log('Highlight removed from storage:', highlightId);
      });
    } else {
      console.log('Highlight not found in storage:', highlightId);
    }
  });
}

// Manifest file content
const manifest = {
  "manifest_version": 3,
  "name": "Content Saver",
  "version": "1.0",
  "description": "Save and highlight text on web pages",
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
};