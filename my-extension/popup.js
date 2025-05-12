// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get references to buttons
  const saveTextBtn = document.getElementById('saveText');
  const highlightTextBtn = document.getElementById('highlightText');
  const highlightColorPicker = document.getElementById('highlightColor');
  const saveImageBtn = document.getElementById('saveImage');
  const saveArticleBtn = document.getElementById('saveArticle');
  const savedItemsBtn = document.getElementById('savedItems');
  const statusDiv = document.getElementById('status');
  // Save selected text
  saveTextBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        statusDiv.textContent = 'Unable to access the active tab!';
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: Extension cannot access this page';
            return;
          }
          
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
      } catch (error) {
        statusDiv.textContent = 'Error communicating with page';
        console.error('Message error:', error);
      }
    });
  });
    // Highlight selected text
  highlightTextBtn.addEventListener('click', function() {
    const highlightColor = highlightColorPicker.value;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        statusDiv.textContent = 'Unable to access the active tab!';
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, function(selectionResponse) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: Extension cannot access this page';
            return;
          }
          
          if (selectionResponse && selectionResponse.selectedText) {
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: "highlightText", color: highlightColor }, function(highlightResponse) {
                if (chrome.runtime.lastError) {
                  statusDiv.textContent = 'Error while highlighting';
                  return;
                }
                
                if (highlightResponse && highlightResponse.success) {
                  // Save highlight information
                  saveToStorage('highlight', {
                    text: selectionResponse.selectedText,
                    color: highlightColor,
                    pageUrl: selectionResponse.pageUrl,
                    pageTitle: selectionResponse.pageTitle,
                    position: selectionResponse.position,
                    highlightId: highlightResponse.highlightId
                  });
                  statusDiv.textContent = 'Text highlighted and saved!';
                } else {
                  statusDiv.textContent = 'Could not highlight text!';
                }
              });
            } catch (error) {
              statusDiv.textContent = 'Error highlighting text';
              console.error('Highlight error:', error);
            }
          } else {
            statusDiv.textContent = 'No text selected!';
          }
        });
      } catch (error) {
        statusDiv.textContent = 'Error communicating with page';
        console.error('Message error:', error);
      }
    });
  });
  // Save current image
  saveImageBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        statusDiv.textContent = 'Unable to access the active tab!';
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getImage"}, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: Extension cannot access this page';
            return;
          }
          
          if (response && response.imageUrl) {
            saveToStorage('image', response.imageUrl);
            statusDiv.textContent = 'Image saved!';
          } else {
            statusDiv.textContent = 'No image found!';
          }
        });
      } catch (error) {
        statusDiv.textContent = 'Error communicating with page';
        console.error('Message error:', error);
      }
    });
  });

  // Save article
  saveArticleBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = tabs[0].url;
      const title = tabs[0].title;
      saveToStorage('article', {url: url, title: title});
      statusDiv.textContent = 'Article saved!';
    });
  });

  // View saved items
  savedItemsBtn.addEventListener('click', function() {
    chrome.tabs.create({url: 'saved.html'});
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
      
      // Use the highlightId if available
      if (type === 'highlight' && content.highlightId) {
        item.id = content.highlightId;
      }
      
      savedItems.push(item);
      chrome.storage.local.set({savedItems: savedItems});
    });
  }
});