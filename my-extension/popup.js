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
  
  // Helper function to disable all buttons except the specified one
  function disableButtonsExcept(exceptButton) {
    const buttons = [saveTextBtn, highlightTextBtn, saveImageBtn, saveArticleBtn];
    buttons.forEach(button => {
      if (button !== exceptButton) {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      }
    });
  }
  
  // Helper function to display error messages securely
  function showErrorMessage(container, mainMessage, subMessage) {
    // Clear the container
    container.textContent = '';
    
    // Create and append the main error message
    const errorSpan = document.createElement('span');
    errorSpan.style.color = '#e74c3c';
    errorSpan.textContent = mainMessage;
    container.appendChild(errorSpan);
    
    // Add a line break
    container.appendChild(document.createElement('br'));
    
    // Create and append the sub-message
    const smallText = document.createElement('small');
    smallText.textContent = subMessage;
    container.appendChild(smallText);
  }
  
  // Check on popup open if we're on a restricted page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      try {
        const url = new URL(tabs[0].url);
        if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
            url.protocol === 'about:' || url.protocol === 'edge:') {          // We're on a restricted page
          statusDiv.textContent = '';
          
          const errorSpan = document.createElement('span');
          errorSpan.style.color = '#e74c3c';
          errorSpan.textContent = 'Chrome-specific pages cannot be accessed';
          statusDiv.appendChild(errorSpan);
          
          statusDiv.appendChild(document.createElement('br'));
          
          const smallText = document.createElement('small');
          smallText.textContent = 'Try using this extension on a regular website';
          statusDiv.appendChild(smallText);
          
          // Disable text highlighting and image saving buttons
          disableButtonsExcept(savedItemsBtn);
        }
      } catch (e) {
        console.error('Error checking page URL:', e);
      }
    }
  });

  // Save selected text
  saveTextBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        statusDiv.textContent = 'Unable to access the active tab!';
        return;
      }
      
      // Check if we can access this tab
      const url = new URL(tabs[0].url);
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
          url.protocol === 'about:' || url.protocol === 'edge:') {
        // Special handling for restricted pages
        statusDiv.innerHTML = '<span style="color: #e74c3c;">Cannot access this page</span><br>' +
                             '<small>Try a regular webpage instead</small>';
        disableButtonsExcept(savedItemsBtn);
        return;
      }
        try {
        // First attempt to send a message to see if content script is already running
        chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
          if (chrome.runtime.lastError) {
            console.log("Content script not ready, injecting now");
            // Content script is not ready, inject it
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              files: ['content.js']
            }).then(() => {
              // Now content script is injected, try sending the message again
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
                  if (chrome.runtime.lastError) {
                    // Still can't communicate
                    console.error('Failed to communicate after injection:', chrome.runtime.lastError);
                    
                    // Clear the status div first
                    statusDiv.textContent = '';
                    
                    // Create and append the error message
                    const errorSpan = document.createElement('span');
                    errorSpan.style.color = '#e74c3c';
                    errorSpan.textContent = 'Extension cannot access this page';
                    statusDiv.appendChild(errorSpan);
                    
                    // Add a line break
                    statusDiv.appendChild(document.createElement('br'));
                    
                    // Add the smaller explanation text
                    const smallText = document.createElement('small');
                    smallText.textContent = 'Please try another webpage';
                    statusDiv.appendChild(smallText);
                    return;
                  }
                  
                  handleSelectedTextResponse(response);
                });
              }, 100); // Give a small delay for the script to initialize
            }).catch(err => {
              console.error('Script injection error:', err);
              statusDiv.textContent = 'Failed to initialize extension on this page';
            });
          } else {
            // Content script is already running, proceed with the regular flow
            chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
              if (chrome.runtime.lastError) {
                // Create and append the error message with safe DOM manipulation
                statusDiv.textContent = '';
                
                const errorSpan = document.createElement('span');
                errorSpan.style.color = '#e74c3c';
                errorSpan.textContent = 'Extension cannot access this page';
                statusDiv.appendChild(errorSpan);
                
                statusDiv.appendChild(document.createElement('br'));
                
                const smallText = document.createElement('small');
                smallText.textContent = 'Please try another webpage';
                statusDiv.appendChild(smallText);
                return;
              }
              
              handleSelectedTextResponse(response);
            });
          }
        });
        
        // Helper function to handle the selected text response
        function handleSelectedTextResponse(response) {
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
        }
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
      
      // Check if we can access this tab
      const url = new URL(tabs[0].url);
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
          url.protocol === 'about:' || url.protocol === 'edge:') {
        // Special handling for restricted pages
        statusDiv.innerHTML = '<span style="color: #e74c3c;">Cannot access this page</span><br>' +
                             '<small>Try a regular webpage instead</small>';
        disableButtonsExcept(savedItemsBtn);
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, function(selectionResponse) {
          if (chrome.runtime.lastError) {
            statusDiv.innerHTML = '<span style="color: #e74c3c;">Extension cannot access this page</span><br>' +
                                '<small>Please try another webpage</small>';
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
      
      // Check if we can access this tab
      const url = new URL(tabs[0].url);
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
          url.protocol === 'about:' || url.protocol === 'edge:') {
        // Special handling for restricted pages
        statusDiv.innerHTML = '<span style="color: #e74c3c;">Cannot access this page</span><br>' +
                             '<small>Try a regular webpage instead</small>';
        disableButtonsExcept(savedItemsBtn);
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getImage"}, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.innerHTML = '<span style="color: #e74c3c;">Extension cannot access this page</span><br>' +
                                '<small>Please try another webpage</small>';
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
      if (!tabs[0]) {
        statusDiv.textContent = 'Unable to access the active tab!';
        return;
      }
      
      // Unlike other functions, articles can be saved from any page
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
