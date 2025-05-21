// Functions to separately handle highlighted and plain text content

// Function to save text without highlighting
function saveTextOnly(content, callback) {
  chrome.storage.local.get(['savedTextItems'], function(result) {
    const savedTextItems = result.savedTextItems || [];
    
    // If no selected text, only save title and URL
    const textContent = content.text || '';
    if (!textContent) {
      // Check for duplicates by title and URL
      const isDuplicate = savedTextItems.some(item => 
        item.pageTitle === (content.pageTitle || content.title || 'Untitled Page') &&
        item.pageUrl === content.pageUrl
      );
      if (isDuplicate) {
        console.log('Title/URL already saved, skipping duplicate');
        if (callback) callback();
        return;
      }
      const pageTitle = content.pageTitle || content.title || 'Untitled Page';
      const textItem = {
        id: 'text-' + Date.now(),
        text: '',
        pageUrl: content.pageUrl,
        pageTitle: pageTitle,
        notes: '',
        timestamp: new Date().toISOString()
      };
      savedTextItems.push(textItem);
      chrome.storage.local.set({ savedTextItems: savedTextItems }, function() {
        console.log('Title/URL saved:', textItem.id);
        if (callback) callback();
      });
      return;
    }
    
    // Check for duplicates
    const isDuplicate = savedTextItems.some(item => 
      item.text === textContent && 
      item.pageUrl === content.pageUrl
    );
    
    if (isDuplicate) {
      console.log('Text already saved, skipping duplicate');
      if (callback) callback();
      return;
    }
    
    // Ensure we have a valid page title
    const pageTitle = content.pageTitle || content.title || 'Untitled Page';
    
    // Create new text item
    const textItem = {
      id: 'text-' + Date.now(),
      text: textContent,
      pageUrl: content.pageUrl,
      pageTitle: pageTitle,
      notes: content.notes || '',
      timestamp: new Date().toISOString()
    };
    
    // Add to storage
    savedTextItems.push(textItem);
    chrome.storage.local.set({ savedTextItems: savedTextItems }, function() {
      console.log('Text saved:', textItem.id);
      if (callback) callback();
    });
  });
}

// Function specifically for highlighted content
function saveHighlightedText(content, callback) {
  chrome.storage.local.get(['savedHighlights'], function(result) {
    const savedHighlights = result.savedHighlights || [];
    
    // Check for duplicates
    const textContent = content.text || '';
    const isDuplicate = savedHighlights.some(item => 
      item.text === textContent && 
      item.pageUrl === content.pageUrl
    );
    
    if (isDuplicate) {
      console.log('Highlight already saved, skipping duplicate');
      if (callback) callback();
      return;
    }
    
    // Ensure we have a valid page title
    const pageTitle = content.pageTitle || content.title || 'Untitled Page';
    
    // Create highlight item
    const highlightItem = {
      id: content.highlightId || 'highlight-' + Date.now(),
      text: textContent,
      pageUrl: content.pageUrl,
      pageTitle: pageTitle,
      notes: content.notes || '',
      color: content.color || '#90ee90', // Default to light green
      timestamp: new Date().toISOString()
    };
    
    // Add to storage
    savedHighlights.push(highlightItem);
    chrome.storage.local.set({ savedHighlights: savedHighlights }, function() {
      console.log('Highlight saved:', highlightItem.id);
      if (callback) callback();
    });
  });
}

// Function to save only the web page title
function savePageTitleOnly(content, callback) {
  chrome.storage.local.get(['savedTitles'], function(result) {
    const savedTitles = result.savedTitles || [];

    // Check for duplicates
    const pageTitle = content.pageTitle || content.title || 'Untitled Page';
    const isDuplicate = savedTitles.some(item => item.pageTitle === pageTitle);

    if (isDuplicate) {
      console.log('Title already saved, skipping duplicate');
      if (callback) callback();
      return;
    }

    // Create new title item
    const titleItem = {
      id: 'title-' + Date.now(),
      pageTitle: pageTitle,
      timestamp: new Date().toISOString()
    };

    // Add to storage
    savedTitles.push(titleItem);
    chrome.storage.local.set({ savedTitles: savedTitles }, function() {
      console.log('Title saved:', titleItem.id);
      if (callback) callback();
    });
  });
}

// Unified function to load all types of content for display
function loadAllSavedContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedItems', 'savedTextItems', 'savedHighlights'], function(result) {
      const items = result.savedItems || [];
      const textItems = result.savedTextItems || [];
      const highlights = result.savedHighlights || [];
      
      // Combine all items into one unified format
      const allItems = [
        // Convert legacy items
        ...items.map(item => {
          // Ensure we have a valid page title
          const pageTitle = (item.content && item.content.pageTitle) || 
                          (item.content && item.content.title) ||
                          item.pageTitle || 
                          'Untitled Page';
          
          return {
            id: item.id,
            type: item.type || 'text',
            text: (item.content && item.content.text) || item.text || '',
            pageUrl: (item.content && item.content.pageUrl) || item.pageUrl || '',
            pageTitle: pageTitle,
            timestamp: item.timestamp || item.date || new Date().toISOString(),
            isHighlight: item.content && item.content.wasHighlighted,
            notes: item.notes || (item.content && item.content.notes) || ''
          };
        }),
        
        // Convert text items
        ...textItems.map(item => {
          return {
            id: item.id,
            type: 'text',
            text: item.text,
            pageUrl: item.pageUrl,
            pageTitle: item.pageTitle || 'Untitled Page',
            timestamp: item.timestamp,
            isHighlight: false,
            notes: item.notes || ''
          };
        }),
        
        // Convert highlight items
        ...highlights.map(item => {
          return {
            id: item.id,
            type: 'highlight',
            text: item.text,
            pageUrl: item.pageUrl,
            pageTitle: item.pageTitle || 'Untitled Page',
            color: item.color,
            timestamp: item.timestamp,
            isHighlight: true,
            notes: item.notes || ''
          };
        })
      ];
      
      // Sort by timestamp, newest first
      allItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      resolve(allItems);
    });
  });
}
