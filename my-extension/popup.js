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
      }      try {
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
        });          // Handle the selected text response
          function handleSelectedTextResponse(response) {
            if (response && response.selectedText) {
              // Generate a unique content ID to help with duplicate detection
              const contentId = `${response.pageUrl}::${response.selectedText.substring(0, 50)}`;
              
              // Check if the text was already highlighted on the website
              if (response.isAlreadyHighlighted && response.existingHighlightColor) {
                // Save as a highlight with the existing color
                saveToStorage('highlight', {
                  text: response.selectedText,
                  color: response.existingHighlightColor,
                  pageUrl: response.pageUrl,
                  pageTitle: response.pageTitle,
                  position: response.position,
                  contentId: contentId
                });
                statusDiv.textContent = 'Highlighted text saved!';
              } else {
                // Save as regular text
                saveToStorage('text', {
                  text: response.selectedText,
                  pageUrl: response.pageUrl,
                  pageTitle: response.pageTitle,
                  contentId: contentId
                });
                statusDiv.textContent = 'Text saved!';
              }
            } else {
              statusDiv.textContent = 'No text selected!';
            }
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
                  // Generate a content ID to help with duplicate detection
                  const contentId = `${selectionResponse.pageUrl}::${selectionResponse.selectedText.substring(0, 50)}`;
                  
                  // Save highlight information
                  saveToStorage('highlight', {
                    text: selectionResponse.selectedText,
                    color: highlightColor,
                    pageUrl: selectionResponse.pageUrl,
                    pageTitle: selectionResponse.pageTitle,
                    position: selectionResponse.position,
                    highlightId: highlightResponse.highlightId,
                    contentId: contentId
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
            // For images, create a unique ID based on image URL
            const imageUrlObj = new URL(response.imageUrl);
            const imagePathname = imageUrlObj.pathname;
            
            saveToStorage('image', {
              url: response.imageUrl,
              contentId: imagePathname
            });
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
      const currentDate = new Date().toISOString();
      
      // Create a key to identify duplicate content
      const contentKey = content.text || content.url || content;
      const pageUrl = content.pageUrl || (content.url ? content.url : null);
      
      // Find existing item with the same content
      const existingItemIndex = savedItems.findIndex(item => {
        // Check if the content matches
        const itemContent = item.content.text || item.content.url || item.content;
        const itemUrl = item.content.pageUrl || (item.content.url ? item.content.url : null);
        
        // Match based on content text and URL
        return (contentKey === itemContent) && 
               (!pageUrl || !itemUrl || pageUrl === itemUrl);
      });
      
      if (existingItemIndex !== -1) {
        // Update the existing item if it's the same content
        const existingItem = savedItems[existingItemIndex];
        
        // If we're highlighting something that was previously just saved as text
        if (type === 'highlight' && existingItem.type === 'text') {
          // Update to a highlight instead of text
          existingItem.type = 'highlight';
          existingItem.content = {
            ...existingItem.content,
            color: content.color,
            highlightId: content.highlightId
          };
          existingItem.date = currentDate;
        } 
        // If we're saving the same highlight again, just update the date
        else if (type === 'highlight' && existingItem.type === 'highlight') {
          existingItem.content.color = content.color;
          existingItem.date = currentDate;
        }
        // Otherwise, just update the date to bring it to the top
        else {
          existingItem.date = currentDate;
        }
        
        console.log('Updated existing item instead of creating a duplicate', existingItem);
      } else {
        // Create a new item if no duplicate exists
        const item = {
          type: type,
          content: content,
          date: currentDate
        };
        
        // Use the highlightId if available
        if (type === 'highlight' && content.highlightId) {
          item.id = content.highlightId;
        }
        
        savedItems.push(item);
        console.log('Added new item', item);
      }
      
      chrome.storage.local.set({savedItems: savedItems});
    });
  }
});
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
      }      try {
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
        });          // Handle the selected text response
          function handleSelectedTextResponse(response) {
            if (response && response.selectedText) {
              // Generate a unique content ID to help with duplicate detection
              const contentId = `${response.pageUrl}::${response.selectedText.substring(0, 50)}`;
              
              // Check if the text was already highlighted on the website
              if (response.isAlreadyHighlighted && response.existingHighlightColor) {
                // Save as a highlight with the existing color
                saveToStorage('highlight', {
                  text: response.selectedText,
                  color: response.existingHighlightColor,
                  pageUrl: response.pageUrl,
                  pageTitle: response.pageTitle,
                  position: response.position,
                  contentId: contentId
                });
                statusDiv.textContent = 'Highlighted text saved!';
              } else {
                // Save as regular text
                saveToStorage('text', {
                  text: response.selectedText,
                  pageUrl: response.pageUrl,
                  pageTitle: response.pageTitle,
                  contentId: contentId
                });
                statusDiv.textContent = 'Text saved!';
              }
            } else {
              statusDiv.textContent = 'No text selected!';
            }
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
                  // Generate a content ID to help with duplicate detection
                  const contentId = `${selectionResponse.pageUrl}::${selectionResponse.selectedText.substring(0, 50)}`;
                  
                  // Save highlight information
                  saveToStorage('highlight', {
                    text: selectionResponse.selectedText,
                    color: highlightColor,
                    pageUrl: selectionResponse.pageUrl,
                    pageTitle: selectionResponse.pageTitle,
                    position: selectionResponse.position,
                    highlightId: highlightResponse.highlightId,
                    contentId: contentId
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
            // For images, create a unique ID based on image URL
            const imageUrlObj = new URL(response.imageUrl);
            const imagePathname = imageUrlObj.pathname;
            
            saveToStorage('image', {
              url: response.imageUrl,
              contentId: imagePathname
            });
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
      const currentDate = new Date().toISOString();
      
      // Create a key to identify duplicate content
      const contentKey = content.text || content.url || content;
      const pageUrl = content.pageUrl || (content.url ? content.url : null);
      
      // Find existing item with the same content
      const existingItemIndex = savedItems.findIndex(item => {
        // Check if the content matches
        const itemContent = item.content.text || item.content.url || item.content;
        const itemUrl = item.content.pageUrl || (item.content.url ? item.content.url : null);
        
        // Match based on content text and URL
        return (contentKey === itemContent) && 
               (!pageUrl || !itemUrl || pageUrl === itemUrl);
      });
      
      if (existingItemIndex !== -1) {
        // Update the existing item if it's the same content
        const existingItem = savedItems[existingItemIndex];
        
        // If we're highlighting something that was previously just saved as text
        if (type === 'highlight' && existingItem.type === 'text') {
          // Update to a highlight instead of text
          existingItem.type = 'highlight';
          existingItem.content = {
            ...existingItem.content,
            color: content.color,
            highlightId: content.highlightId
          };
          existingItem.date = currentDate;
        } 
        // If we're saving the same highlight again, just update the date
        else if (type === 'highlight' && existingItem.type === 'highlight') {
          existingItem.content.color = content.color;
          existingItem.date = currentDate;
        }
        // Otherwise, just update the date to bring it to the top
        else {
          existingItem.date = currentDate;
        }
        
        console.log('Updated existing item instead of creating a duplicate', existingItem);
      } else {
        // Create a new item if no duplicate exists
        const item = {
          type: type,
          content: content,
          date: currentDate
        };
        
        // Use the highlightId if available
        if (type === 'highlight' && content.highlightId) {
          item.id = content.highlightId;
        }
        
        savedItems.push(item);
        console.log('Added new item', item);
      }
      
      chrome.storage.local.set({savedItems: savedItems});
    });
  }
});
