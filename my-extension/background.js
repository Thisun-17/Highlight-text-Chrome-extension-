// Set up context menu items when extension is installed
chrome.runtime.onInstalled.addListener(function() {
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
  
  // Initialize user preferences for highlight color
  chrome.storage.local.get(['highlightColor'], function(result) {
    if (!result.highlightColor) {
      chrome.storage.local.set({highlightColor: '#ffff00'});
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "saveText" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {action: "getSelectedText"}, function(response) {
      if (response) {
        saveToStorage('text', {
          text: info.selectionText,
          pageUrl: tab.url,
          pageTitle: tab.title
        });
      }
    });
  } 
  else if (info.menuItemId === "highlightText" && info.selectionText) {
    // Get user's preferred highlight color
    chrome.storage.local.get(['highlightColor'], function(result) {
      const color = result.highlightColor || '#ffff00';
        chrome.tabs.sendMessage(tab.id, {action: "highlightText", color: color}, function(response) {
        if (response && response.success) {
          saveToStorage('highlight', {
            text: info.selectionText,
            color: color,
            pageUrl: tab.url,
            pageTitle: tab.title,
            highlightId: response.highlightId
          });
        }
      });
    });
  }
  else if (info.menuItemId === "saveImage" && info.srcUrl) {
    saveToStorage('image', info.srcUrl);
  }
  else if (info.menuItemId === "saveArticle") {
    saveToStorage('article', {url: tab.url, title: tab.title});
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "removeHighlight" && request.highlightId) {
    removeHighlightFromStorage(request.highlightId);
  }
});

// Helper function to save to Chrome storage
function saveToStorage(type, content) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    const item = {
      type: type,
      content: content,
      date: new Date().toISOString()
    };
    
    // Use the highlightId if provided
    if (type === 'highlight' && content.highlightId) {
      item.id = content.highlightId;
    } else {
      item.id = 'item-' + Date.now();
    }
    
    savedItems.push(item);
    chrome.storage.local.set({savedItems: savedItems});
  });
}

// Helper function to remove a highlight from storage
function removeHighlightFromStorage(highlightId) {
  chrome.storage.local.get(['savedItems'], function(result) {
    let savedItems = result.savedItems || [];
    savedItems = savedItems.filter(item => item.id !== highlightId);
    chrome.storage.local.set({savedItems: savedItems});
  });
}