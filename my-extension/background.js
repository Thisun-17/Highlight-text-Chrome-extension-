// Set up context menu items when extension is installed
chrome.runtime.onInstalled.addListener(function() {
  console.log("Data FlowX extension installed/updated");
  
  // Create context menu items
  chrome.contextMenus.create({
    id: "saveText",
    title: "Save Text",
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
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "saveText" && info.selectionText) {
    // Save text without highlighting
    saveToStorage('text', {
      text: info.selectionText,
      pageUrl: tab.url,
      pageTitle: tab.title
    }, function() {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Text Saved',
        message: 'The selected text has been saved.'
      });
    });
  } 
  else if (info.menuItemId === "saveImage" && info.srcUrl) {
    saveToStorage('image', info.srcUrl, function() {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Image Saved',
        message: 'The image has been saved.'
      });
    });
  }
  else if (info.menuItemId === "saveArticle") {
    saveToStorage('article', {
      url: tab.url,
      title: tab.title
    }, function() {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Article Saved',
        message: 'This article has been saved.'
      });
    });
  }
});

// Helper function to save to Chrome storage
function saveToStorage(type, content, callback) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    // Check for duplicates
    const isDuplicate = checkForDuplicate(savedItems, type, content);
    
    if (isDuplicate) {
      console.log('Item with same content already exists. Skipping duplicate.');
      if (callback) callback(); // Call the callback even if duplicate
      return;
    }
    
    // Create the new item
    const item = {
      id: 'item-' + Date.now(),
      type: type,
      content: content,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString() // Keep for backwards compatibility
    };
    
    savedItems.push(item);
    chrome.storage.local.set({savedItems: savedItems}, function() {
      // Call the callback function if provided
      if (callback) callback();
    });
  });
}

// Helper function to check for duplicates
function checkForDuplicate(savedItems, type, content) {
  // For text items, check if the same text from the same page already exists
  if (type === 'text') {
    return savedItems.some(item => {
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
  
  // For images, check if the same image URL is already saved
  if (type === 'image') {
    return savedItems.some(item => 
      item.type === 'image' && 
      item.content === content
    );
  }
  
  return false;
}
