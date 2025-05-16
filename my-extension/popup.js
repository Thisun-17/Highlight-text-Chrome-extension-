// Add this helper function at the top to add diagnostic capabilities
function detectDOMRestrictions() {
  try {
    // Create a diagnostic object to return
    const diagnostics = {
      canModifyDOM: true,
      hasContentSecurityPolicy: false,
      cspDetails: null,
      hasIframes: false,
      iframeCount: 0,
      shadowRootCount: 0,
      usesShadowDOM: false,
      browserInfo: navigator.userAgent
    };
    
    // Check for Content Security Policy
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
      diagnostics.hasContentSecurityPolicy = true;
      diagnostics.cspDetails = metaCSP.content;
    }
    
    // Check for iframes
    const iframes = document.querySelectorAll('iframe');
    if (iframes.length > 0) {
      diagnostics.hasIframes = true;
      diagnostics.iframeCount = iframes.length;
    }
    
    // Check for Shadow DOM
    function checkForShadowRoots(node) {
      if (node.shadowRoot) {
        diagnostics.usesShadowDOM = true;
        diagnostics.shadowRootCount++;
      }
      
      if (node.children) {
        Array.from(node.children).forEach(child => checkForShadowRoots(child));
      }
    }
    checkForShadowRoots(document.documentElement);
    
    return diagnostics;
  } catch (e) {
    return { error: e.message, canModifyDOM: false };
  }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Debug variables and setup
  const debugSection = document.querySelector('.debug-section');
  const debugContent = document.getElementById('debugContent');
  const toggleDebug = document.getElementById('toggleDebug');
  const manualCapture = document.getElementById('manualCapture');
  
  // Hide debug section by default - user requested no debug info
  if (debugSection) {
    debugSection.style.display = 'none';
  }
  
  // Function to log debug messages (but don't display them by default)
  function logDebug(message) {
    // Still log to console for developer troubleshooting
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}\n`;
    console.log(logMessage.trim());
    
    // Only add to debug content if it exists
    if (debugContent) {
      debugContent.textContent += logMessage;
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }
  
  // Only show debug with Shift+Alt+D key combination
  document.addEventListener('keydown', function(e) {
    if (e.shiftKey && e.altKey && e.key === 'D' && debugSection) {
      debugSection.style.display = debugSection.style.display === 'none' ? 'block' : 'none';
    }
  });
  
  // If toggleDebug button exists, still allow it to work
  if (toggleDebug) {
    // Hide the button by default
    toggleDebug.style.display = 'none';
    
    toggleDebug.addEventListener('click', function() {
      const content = debugContent.style.display;
      debugContent.style.display = content === 'none' ? 'block' : 'none';
    });
  }

  // Also hide any diagnostic buttons by default
  if (manualCapture) {
    manualCapture.style.display = 'none';
  }
  
  // Hide diagnose button as well
  const diagnoseButton = document.querySelector('.manual-capture-btn');
  if (diagnoseButton) {
    diagnoseButton.style.display = 'none';
  }
  
  // Get UI elements
  const statusDiv = document.getElementById('status') || document.createElement('div');
  const selectedTextInput = document.querySelector('.selected-text-input');
  const noteInput = document.querySelector('.note-input');
  
  logDebug('Popup opened, initializing...');
  
  // Close button functionality
  const closeButton = document.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      window.close();
    });
  }

  // Function to get selected text and populate the input field
  function retrieveSelectedText() {
    logDebug('Starting text retrieval process');
    
    if (!selectedTextInput) {
      logDebug('ERROR: Selected text input element not found!');
      return;
    }
    
    // Try multiple sources to get the selected text
    
    // 1. First check chrome.storage.local
    logDebug('Checking chrome.storage.local for text...');
    chrome.storage.local.get(['currentSelectedText'], function(result) {
      if (result && result.currentSelectedText) {
        logDebug(`FOUND in storage: "${result.currentSelectedText.substring(0, 30)}..."`);
        selectedTextInput.value = result.currentSelectedText;
        if (noteInput) noteInput.focus();
        return; // Exit if we found text
      }
      
      logDebug('No text found in storage, trying background.js');
      
      // 2. Try getting from background.js via message
      chrome.runtime.sendMessage({ action: "getSelectedText" }, function(backgroundResponse) {
        if (backgroundResponse && backgroundResponse.text) {
          logDebug(`FOUND from background: "${backgroundResponse.text.substring(0, 30)}..."`);
          selectedTextInput.value = backgroundResponse.text;
          if (noteInput) noteInput.focus();
          return; // Exit if we found text
        }
        
        logDebug('No text from background, trying content script');
        
        // 3. Try getting from content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs && tabs[0]) {
            logDebug(`Sending getSelectedText to tab ${tabs[0].id}`);
            
              chrome.tabs.sendMessage(tabs[0].id, {action: "getSelectedText"}, function(response) {
                if (chrome.runtime.lastError) {
                logDebug(`ERROR: Content script message failed - ${chrome.runtime.lastError.message}`);
                tryScriptingAPI();
                  return;
                }
                
                if (response && response.text) {
                logDebug(`FOUND from content: "${response.text.substring(0, 30)}..."`);
                  selectedTextInput.value = response.text;
                chrome.storage.local.set({ 'currentSelectedText': response.text });
                if (noteInput) noteInput.focus();
                } else {
                logDebug('No text from content script, trying scripting API');
                tryScriptingAPI();
              }
            });
          } else {
            logDebug('ERROR: No active tab found for content script message');
            tryScriptingAPI();
          }
        });
      });
    });
    
    // Helper function for the final attempt with scripting API
    function tryScriptingAPI() {
      logDebug('Attempting direct scripting API access...');
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) {
          logDebug('ERROR: No active tab found for scripting');
          return;
        }
        
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: getSelectionFromPage
        }, function(results) {
          if (chrome.runtime.lastError) {
            logDebug(`ERROR: Scripting execution failed - ${chrome.runtime.lastError.message}`);
            return;
          }
          
          if (results && results[0] && results[0].result) {
            logDebug(`FOUND via scripting: "${results[0].result.substring(0, 30)}..."`);
            selectedTextInput.value = results[0].result;
            chrome.storage.local.set({ 'currentSelectedText': results[0].result });
            if (noteInput) noteInput.focus();
          } else {
            logDebug('FAILED: No text found via any method');
          }
        });
      });
    }
  }
  
  // Function to get selection text directly from page
  function getSelectionFromPage() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
  }
  
  // Retrieve the selected text when the popup opens
  retrieveSelectedText();

  // Function to save content to storage
  function saveToStorage(type, content, callback) {
    chrome.storage.local.get(['savedItems'], function(result) {
      const savedItems = result.savedItems || [];
      const timestamp = new Date().toISOString();
      const id = 'item-' + Date.now();
      
      // Check for duplicates before saving
      const isDuplicate = checkForDuplicate(savedItems, type, content);
      
      if (isDuplicate) {
        console.log("Item already exists, not saving duplicate");
        showStatus('Item already saved!');
        if (callback) callback(); // Call the callback even if duplicate
        return; // Exit without saving
      }      // First highlight the text if it's a text selection
      if (type === 'text') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {          chrome.tabs.sendMessage(tabs[0].id, {
            action: "highlightSelectedText",
            highlightId: id,
            selectionText: content.text, // Pass the selected text
            color: "#90EE90" // Always use light green
          }, function(response) {
            if (response && response.success) {
              // Save the item after successful highlighting
              savedItems.push({
                id: id,
                type: type,
                timestamp: timestamp,
                date: timestamp,      // Keep date field for backwards compatibility
                content: content,     // This now includes 'notes' field if provided
                highlightId: id
              });
              
              // Update storage after highlighting
              chrome.storage.local.set({ savedItems: savedItems }, function() {
                console.log(`${type} saved with id: ${id}`);
                if (callback) callback();
              });
            } else {
              console.error("Failed to highlight:", response ? response.error : "Unknown error");
              showStatus('Failed to highlight text');
              if (callback) callback();
            }
          });
        });
        return; // Exit here as we're handling the save in the callback
      }
      
      // Standard item saving for non-text items
      savedItems.push({
        id: id,
        type: type,
        timestamp: timestamp,
        date: timestamp,      // Keep date field for backwards compatibility
        content: content
      });
      
      // Update storage
      chrome.storage.local.set({ savedItems: savedItems }, function() {
        console.log(`${type} saved with id: ${id}`);
        // Execute callback if one was provided
        if (callback) callback();
      });
    });
  }

  // Helper function to check for duplicates
  function checkForDuplicate(savedItems, type, content) {
    // For text items, check if the same text from the same page already exists
    if (type === 'text') {
      return savedItems.some(item => {
        // Check for standard text items
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
    
    return false;
  }

  // Enhancement for status messages
  function showStatus(message, isError = false) {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'status-area';
      
      if (isError) {
        statusDiv.classList.add('error-message');
      } else {
        statusDiv.classList.add('success-message');
      }
      
      // Auto-hide success messages after 3 seconds
      if (!isError) {
        setTimeout(() => {
          statusDiv.textContent = '';
          statusDiv.className = 'status-area';
        }, 3000);
      }
    }
  }

  // Save article functionality if button exists
  const saveArticleBtn = document.getElementById('saveArticle');
  if (saveArticleBtn) {
    saveArticleBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          showStatus('Unable to access the active tab!', true);
          return;
        }
        
        // Articles can be saved from any page
        const url = tabs[0].url;
        const title = tabs[0].title;
        saveToStorage('article', {url: url, title: title}, function() {
          // Show success message and keep popup open
          showStatus('Article saved!');
        });
      });
    });
  }
  // View saved items
  const savedItemsBtn = document.getElementById('savedItems');
  if (savedItemsBtn) {
    savedItemsBtn.addEventListener('click', function() {
      chrome.tabs.create({url: 'saved.html'});
      console.log('Opening saved items page');
    });
  } else {
    console.error('savedItems button not found');
  }
  // Add to library button functionality with enhanced highlighting capabilities
  const addToLibraryBtn = document.getElementById('addToLibrary');
  if (addToLibraryBtn) {
    logDebug("Add to Library button found, setting up click handler");
    
    addToLibraryBtn.addEventListener('click', function() {
      logDebug("Add to Library button clicked");
      
      // Get the values from both input fields
      const selectedText = selectedTextInput ? selectedTextInput.value.trim() : "";
      const noteText = noteInput ? noteInput.value.trim() : "";
      
      if (!selectedText) {
        showStatus('No text selected to save', true);
        logDebug("Error: No text selected to save");
        return;
      }
      
      // Get current tab info
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          showStatus('Unable to access the active tab!', true);
          logDebug("Error: Unable to access active tab");
          return;
        }
        
        logDebug(`Creating content object with text: "${selectedText.substring(0, 30)}..."`);
        
        // Create content object with text and notes
        const content = {
          text: selectedText,
          notes: noteText,
          pageUrl: tabs[0].url,
          pageTitle: tabs[0].title
        };
        
        // Generate a unique ID for this highlight
        const highlightId = 'highlight-' + Date.now();
        
        // Track attempts and try different approaches
        let attemptCount = 0;
        const maxAttempts = 3;
        
        // Start with direct highlighting method
        tryHighlight();
        
        // Function to attempt highlighting with different methods
        function tryHighlight() {
          attemptCount++;
          logDebug(`Highlight attempt ${attemptCount}/${maxAttempts}`);
          
        // Choose the appropriate method based on attempt number
          if (attemptCount === 1) {
            // First try: standard findAndHighlightText
            logDebug("Attempting to highlight with primary method");
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "findAndHighlightText",
              text: selectedText,
              highlightId: highlightId,
              color: "#90EE90" // Light green color
            }, handleHighlightResponse);
          } 
          else if (attemptCount === 2) {
            // Second try: Try highlight directly using highlightSelectedText
            logDebug("Attempting to highlight with highlightSelectedText method");
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "highlightSelectedText",
              selectionText: selectedText,
              highlightId: highlightId
            }, handleHighlightResponse);
          }
          else if (attemptCount === 3) {
            // Third try: direct scripting executeScript
            logDebug("Attempting to highlight with scripting API");
            injectHighlightStyle(tabs[0].id, selectedText, highlightId, content);
          }
        }
        
        // Handle response from highlight attempt
        function handleHighlightResponse(response) {
          if (chrome.runtime.lastError) {
            logDebug(`Error with highlighting: ${chrome.runtime.lastError.message}`);
            
            // Try next method if we haven't exceeded attempts
            if (attemptCount < maxAttempts) {
              tryHighlight();
              return;
            } else {
              // Save without highlighting if all attempts fail
              logDebug("All highlight attempts failed, saving without highlight");
              content.wasHighlighted = false;
              saveTextItem(content, highlightId, false);
              return;
            }
          }
          
          if (response && response.success) {
            logDebug(`Highlighting successful on attempt ${attemptCount}`);
            content.highlightId = highlightId;
            content.wasHighlighted = true;
            content.highlightMethod = `method-${attemptCount}`;
            saveTextItem(content, highlightId, true);
          } else {
            logDebug(`Highlight attempt ${attemptCount} failed: ${response ? response.error : "Unknown error"}`);
            
            // Try next method if we haven't exceeded attempts
            if (attemptCount < maxAttempts) {
              tryHighlight();
            } else {
              // Save without highlighting if all attempts fail
              logDebug("All highlight attempts failed, saving without highlight");
              content.wasHighlighted = false;
              saveTextItem(content, highlightId, false);
            }
          }
        }
      });
    });
  } else {
    logDebug("ERROR: Add to Library button not found!");
  }
  
  // Helper function to inject content script if it's not loaded
  function injectContentScriptAndRetry(tabId, text, highlightId) {
    logDebug("Trying to inject content script...");
    
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['content.js']
        }, function() {
      if (chrome.runtime.lastError) {
        logDebug(`Failed to inject script: ${chrome.runtime.lastError.message}`);
        // If injection fails, use the manual highlight approach
        injectHighlightStyle(tabId, text, highlightId);
        return;
      }
      
      // Wait a moment for the script to initialize
          setTimeout(() => {
        // Try highlighting again
        chrome.tabs.sendMessage(tabId, {
          action: "findAndHighlightText",
          text: text,
          highlightId: highlightId
        }, function(response) {
          if (chrome.runtime.lastError) {
            logDebug(`Still failed after injection: ${chrome.runtime.lastError.message}`);
            showStatus('Could not highlight text, but saved to library', true);
            
            // Still save the text without highlighting
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                const content = {
                  text: text,
                  highlightId: highlightId,
                  pageUrl: tabs[0].url,
                  pageTitle: tabs[0].title,
                  wasHighlighted: false
                };
                saveTextItem(content, highlightId, false);
              }
            });
          } else if (response && response.success) {
            logDebug("Text successfully highlighted after script injection");
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                const content = {
                  text: text,
                  highlightId: highlightId,
                  pageUrl: tabs[0].url,
                  pageTitle: tabs[0].title,
                  wasHighlighted: true
                };
                saveTextItem(content, highlightId, true);
              }
            });
          } else {
            logDebug("Highlighting still failed after script injection");
            showStatus('Could not highlight text, but saved to library', true);
            
            // Still save the text without highlighting
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                const content = {
                  text: text,
                  highlightId: highlightId,
                  pageUrl: tabs[0].url,
                  pageTitle: tabs[0].title,
                  wasHighlighted: false
                };
                saveTextItem(content, highlightId, false);
              }
            });
          }
        });
      }, 500);
    });
  }
  
  // Manual highlight function - last resort
  function injectHighlightStyle(tabId, text, highlightId, content) {
    logDebug("Trying direct style injection as last resort...");
    
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: function(text, highlightId) {
        try {
          // Add highlight style if needed
          if (!document.querySelector('#data-flowx-styles')) {
            const style = document.createElement('style');
            style.id = 'data-flowx-styles';
            style.textContent = `
              .data-flowx-highlight {
                background-color: #90EE90 !important;
                display: inline !important;
                padding: 0 1px !important;
                margin: 0 1px !important;
              }
            `;
            document.head.appendChild(style);
          }
          
          // Simple text search and highlight
          const textNodes = [];
          const walk = document.createTreeWalker(
            document.body, 
            NodeFilter.SHOW_TEXT, 
            { acceptNode: n => n.textContent.includes(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
          );
          
          while (walk.nextNode()) {
            textNodes.push(walk.currentNode);
          }
          
          // Go through all matching nodes and try to highlight
          for (const node of textNodes) {
            try {
              const index = node.textContent.indexOf(text);
              if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                
                const span = document.createElement('span');
                span.className = 'data-flowx-highlight';
                span.dataset.highlightId = highlightId;
                
                range.surroundContents(span);
                return true;
              }
            } catch (e) {
              console.error("Error highlighting:", e);
            }
          }
          return false;
        } catch (e) {
          console.error("Highlighting error:", e);
          return false;
        }
      },
      args: [text, highlightId]
    }, function(results) {
      const success = results && results[0] && results[0].result === true;
      
      if (success) {
        logDebug("Successfully highlighted via direct injection");
        if (content) {
          content.wasHighlighted = true;
          saveTextItem(content, highlightId, true);
        } else {
          // If we don't have content yet, create it
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              const newContent = {
                text: text,
                highlightId: highlightId,
                pageUrl: tabs[0].url,
                pageTitle: tabs[0].title,
                wasHighlighted: true
              };
              saveTextItem(newContent, highlightId, true);
            }
          });
        }
      } else {
        logDebug("Failed to highlight via direct injection");
        if (content) {
          content.wasHighlighted = false;
          saveTextItem(content, highlightId, false);
        } else {
          // If we don't have content yet, create it
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              const newContent = {
                text: text,
                highlightId: highlightId,
                pageUrl: tabs[0].url,
                pageTitle: tabs[0].title,
                wasHighlighted: false
              };
              saveTextItem(newContent, highlightId, false);
            }
          });
        }
      }
    });
  }

  // Helper function to save the text item
  function saveTextItem(content, highlightId, wasHighlighted) {
    logDebug("Saving text to storage");
    
    // Add highlight info to the content object
    content.highlightId = highlightId;
    content.wasHighlighted = wasHighlighted;
    
    // Add metadata specifically for highlighting persistence
    content.metadata = {
      isHighlight: true,
      highlightId: highlightId,
      color: "#90EE90", // Light green
      timestamp: new Date().toISOString()
    };
    
    // Save to storage
    chrome.storage.local.get(['savedItems'], function(result) {
      const savedItems = result.savedItems || [];
      
      // Create the new item
      const newItem = {
        id: highlightId,
        type: 'text',
        content: content,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString(), // For backwards compatibility
        notes: content.notes || "" // Add notes directly at the root level to ensure it's accessible
      };
      
      // Check for duplicates
      const isDuplicate = savedItems.some(item => 
        item.type === 'text' && 
        item.content && 
        item.content.text === content.text &&
        item.content.pageUrl === content.pageUrl
      );
      
      if (isDuplicate) {
        logDebug("This text has already been saved (duplicate)");
        showStatus('This text is already in your library!');
        return;
      }
      
      // Add to saved items
      savedItems.push(newItem);
      
      // Save to storage
      chrome.storage.local.set({ savedItems: savedItems }, function() {
        logDebug(`Text saved with ID: ${highlightId}`);
        showStatus(wasHighlighted ? 'Added to library and highlighted!' : 'Added to library!');
        
        // After saving, send a message to the content script to ensure the highlight persists
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "restoreHighlights"
            }, function(response) {
              logDebug("Sent restoreHighlights message to ensure highlight persists");
            });
          }
        });
        
        // Clear both input fields
        if (selectedTextInput) selectedTextInput.value = '';
        if (noteInput) noteInput.value = '';
        
        // Also clear the stored selection from chrome.storage
        chrome.storage.local.remove('currentSelectedText', function() {
          logDebug("Cleared the stored selection from chrome.storage");
        });
        
        // Clear the local tracking variable for the selection
        try {
          localStorage.removeItem('extensionSelectedText');
        } catch (e) {
          logDebug("Failed to clear localStorage: " + e.message);
        }
        
        // Notify the background script to clear its stored selection
        chrome.runtime.sendMessage({
          action: "clearSelectedText"
        }, function(response) {
          logDebug("Notified background script to clear selection");
        });
        
        // Notify the content script to clear any selection in the page
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "clearSelection"
            }, function(response) {
              logDebug("Notified content script to clear selection");
            });
          }
        });
      });
    });
  }

  // Save Full Article functionality
  const saveFullArticleBtn = document.getElementById('saveFullArticle');
  if (saveFullArticleBtn) {
    logDebug("Save Full Article button found, setting up click handler");
    
    saveFullArticleBtn.addEventListener('click', function() {
      logDebug("Save Full Article button clicked");
      
      // Get current tab info
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          showStatus('Unable to access the active tab!', true);
          logDebug("Error: Unable to access active tab");
          return;
        }
        
        // Extract article content from the page
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: extractArticleContent
        }, function(results) {
          if (chrome.runtime.lastError) {
            showStatus('Error extracting article content', true);
            logDebug(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const articleContent = results[0].result;
            logDebug(`Extracted article content: ${articleContent.text.substring(0, 50)}...`);
            
            const noteText = noteInput ? noteInput.value.trim() : "";
            
            // Create content object with article text and notes
            const content = {
              text: articleContent.text,
              html: articleContent.html,
              notes: noteText,
              pageUrl: tabs[0].url,
              pageTitle: tabs[0].title,
              isFullArticle: true
            };
            
            // Save the full article
            saveToStorage('article', content, function() {
              showStatus('Full article saved to library!');
              // Clear note input after saving
              if (noteInput) noteInput.value = '';
            });
          } else {
            showStatus('No article content found', true);
            logDebug("Error: No article content extracted");
          }
        });
      });
    });
  } else {
    logDebug("ERROR: Save Full Article button not found!");
  }
  
  // Function to extract article content from the page
  function extractArticleContent() {
    try {
      // Try to find the main article content
      const possibleArticleSelectors = [
        'article',
        '[role="article"]',
        '.article',
        '.post-content',
        '.entry-content',
        '.content',
        'main',
        '#main',
        '.main-content',
        '.post',
        '.blog-post'
      ];
      
      let articleElement = null;
      
      // Try each selector until we find a match
      for (const selector of possibleArticleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Pick the element with the most text content
          articleElement = Array.from(elements).sort((a, b) => 
            b.textContent.trim().length - a.textContent.trim().length
          )[0];
          break;
        }
      }
      
      // If no article element was found, use the body as fallback
      if (!articleElement) {
        // Exclude common non-content areas
        const nonContentSelectors = [
          'header', 'footer', 'nav', 'aside', 
          '.header', '.footer', '.nav', '.sidebar',
          '.comments', '.menu', '.navigation',
          '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
        ];
        
        // Create a deep clone of the body to avoid modifying the actual page
        const bodyClone = document.body.cloneNode(true);
        
        // Remove non-content elements from the clone
        nonContentSelectors.forEach(selector => {
          const elements = bodyClone.querySelectorAll(selector);
          elements.forEach(element => element.remove());
        });
        
        articleElement = bodyClone;
      }
      
      // Clean up the article content (remove scripts, styles, etc.)
      const cleanupSelectors = ['script', 'style', 'noscript', 'iframe', 'svg', '.ad', '.ads', '.advertisement'];
      cleanupSelectors.forEach(selector => {
        const elements = articleElement.querySelectorAll(selector);
        elements.forEach(element => element.remove());
      });
      
      // Get the clean HTML and text content
      const htmlContent = articleElement.innerHTML;
      const textContent = articleElement.textContent.trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
        .replace(/\n+/g, '\n') // Replace multiple new lines with a single new line
        .substring(0, 100000); // Limit to 100,000 characters to avoid storage issues
      
      return {
        html: htmlContent,
        text: textContent
      };
    } catch (error) {
      console.error("Error extracting article content:", error);
      return null;
    }
  }

  // View Library button functionality
  const viewLibraryBtn = document.getElementById('viewLibrary');
  if (viewLibraryBtn) {
    logDebug("View Library button found, setting up click handler");
    
    viewLibraryBtn.addEventListener('click', function() {
      logDebug("View Library button clicked");
      
      // Open the saved.html page in a new tab
      chrome.tabs.create({url: 'saved.html'});
      
      // Close the popup after clicking
      window.close();
    });
  } else {
    logDebug("ERROR: View Library button not found!");
  }
});