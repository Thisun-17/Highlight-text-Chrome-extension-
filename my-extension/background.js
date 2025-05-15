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

  // Create a restore highlights menu item
  chrome.contextMenus.create({
    id: "restoreHighlights",
    title: "Restore All Highlights",
    contexts: ["page"]
  });
});

// Listen for tab updates to restore highlights when page loads
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only run when the page has completed loading
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log('Tab updated and completed loading:', tab.url);
    
    // Wait a moment for the page to stabilize
    setTimeout(() => {
      console.log('Sending restoreHighlights message to tab:', tabId);
      
      // Send message to content script to restore highlights
      chrome.tabs.sendMessage(tabId, {
        action: 'restoreHighlights',
        url: tab.url
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Error restoring highlights:', chrome.runtime.lastError.message);
          // Content script might not be loaded yet, so try injecting it
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
          }, function() {
            // After injection, try again to restore highlights
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                action: 'restoreHighlights',
                url: tab.url
              });
            }, 500);
          });
        } else {
          console.log('Restore highlights message sent successfully');
        }
      });
    }, 1000);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log("Context menu clicked:", info.menuItemId);
  
  if (info.menuItemId === "saveText" && info.selectionText) {
    console.log("Save Text clicked with selection:", info.selectionText);
    const highlightId = 'highlight-' + Date.now();
    
    // Add a very small delay to ensure selection is still available
    setTimeout(() => {
      // First highlight the text with light green color
      chrome.tabs.sendMessage(tab.id, {
        action: "highlightSelectedText",
        highlightId: highlightId,
        color: "#90EE90", // Ensure light green color is passed
        selectionText: info.selectionText // Send the selected text for better reliability
      }, function(response) {
        console.log("Highlight response:", response);
        
        // Check for chrome runtime errors
        if (chrome.runtime.lastError) {
          console.error("Chrome runtime error:", chrome.runtime.lastError);
        }
        
        if (response && response.success) {
          // Save text with highlighting
          saveToStorage('text', {
            text: info.selectionText,
            pageUrl: tab.url,
            pageTitle: tab.title,
            highlightId: highlightId
          }, function() {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Text Saved',
              message: 'The selected text has been saved and highlighted.'
            });
          });
        } else {
          // If highlighting fails, still save the text
          saveToStorage('text', {
            text: info.selectionText,
            pageUrl: tab.url,
            pageTitle: tab.title
          }, function() {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Text Saved',
              message: 'The text has been saved (highlighting failed).'
            });
          });
        }
      });
    }, 50); // 50ms delay
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
    // First try to get a better article title and description
    chrome.tabs.executeScript(tab.id, {
      code: `{
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';
        const articleText = document.querySelector('article')?.textContent?.substring(0, 200) + '...' || '';
        
        {
          betterTitle: ogTitle || document.title,
          description: ogDescription || metaDescription || articleText,
          url: window.location.href,
          pageTitle: document.title
        }
      }`
    }, function(results) {
      let articleData = {
        url: tab.url,
        title: tab.title,
        pageTitle: tab.title,
        text: tab.title // Default text is the title
      };
      
      // If we got better data from the page, use it
      if (results && results[0]) {
        const pageData = results[0];
        articleData = {
          url: pageData.url || tab.url,
          title: pageData.betterTitle || tab.title,
          pageTitle: pageData.pageTitle || tab.title,
          text: pageData.description || tab.title,
          pageUrl: pageData.url || tab.url
        };
      }
      
      // Save with the enhanced data
      saveToStorage('article', articleData, function() {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Article Saved',
          message: 'This article has been saved.'
        });
      });
    });
  }
  else if (info.menuItemId === "restoreHighlights") {
    // Manual trigger to restore highlights
    chrome.tabs.sendMessage(tab.id, {
      action: "restoreHighlights",
      url: tab.url
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error("Error restoring highlights:", chrome.runtime.lastError.message);
        
        // Try to inject the content script if it's not loaded
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        }, function() {
          // After injection, try again
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: "restoreHighlights",
              url: tab.url
            });
          }, 500);
        });
      } else {
        console.log("Manual highlight restoration triggered");
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Highlights Restored',
          message: 'Attempting to restore all highlights on this page.'
        });
      }
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

// Keep track of the last selected text
let lastSelectedText = '';

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("Background script received message:", message.action);
  
  // Store selected text from content script
  if (message.action === "saveSelectedText" && message.text) {
    console.log("Background received selected text:", message.text);
    lastSelectedText = message.text;
    
    // Store it in local storage for persistence
    chrome.storage.local.set({ 'currentSelectedText': message.text }, function() {
      console.log("Text saved in storage by background script");
    });
    
    sendResponse({success: true});
  }
  // Clear selected text after saving to library
  else if (message.action === "clearSelectedText") {
    console.log("Background clearing selected text");
    lastSelectedText = '';
    
    // Remove from storage
    chrome.storage.local.remove('currentSelectedText', function() {
      console.log("Text cleared from storage by background script");
    });
    
    sendResponse({success: true});
  }
  // Provide text when requested by popup
  else if (message.action === "getSelectedText") {
    console.log("Background providing selected text:", lastSelectedText);
    
    // If we don't have text in memory, check storage
    if (!lastSelectedText) {
      chrome.storage.local.get(['currentSelectedText'], function(result) {
        if (result && result.currentSelectedText) {
          console.log("Background found text in storage:", result.currentSelectedText);
          lastSelectedText = result.currentSelectedText;
          sendResponse({text: lastSelectedText});
        } else {
          console.log("Background could not find any selected text");
          sendResponse({text: ""});
        }
      });
      return true; // Keep the channel open for async response
    }
    
    sendResponse({text: lastSelectedText || ""});
  }
  return true;
});

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
