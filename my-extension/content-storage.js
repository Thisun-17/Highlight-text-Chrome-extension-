// Functions to separately handle highlighted and plain text content

// Function to save text without highlighting
function saveTextOnly(content, callback) {
  chrome.storage.local.get(['savedTextItems'], function(result) {
    const savedTextItems = result.savedTextItems || [];
    
    // Check for duplicates
    const textContent = content.text || '';
    const isDuplicate = savedTextItems.some(item => 
      item.text === textContent && 
      item.pageUrl === content.pageUrl
    );
    
    if (isDuplicate) {
      console.log('Text already saved, skipping duplicate');
      if (callback) callback();
      return;
    }
    
    // Create new text item
    const textItem = {
      id: 'text-' + Date.now(),
      text: textContent,
      pageUrl: content.pageUrl,
      pageTitle: content.pageTitle,
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
    
    // Create highlight item
    const highlightItem = {
      id: content.highlightId || 'highlight-' + Date.now(),
      text: textContent,
      pageUrl: content.pageUrl,
      pageTitle: content.pageTitle,
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
          return {
            id: item.id,
            type: item.type || 'text',
            text: (item.content && item.content.text) || item.text || '',
            pageUrl: (item.content && item.content.pageUrl) || item.pageUrl || '',
            pageTitle: (item.content && item.content.pageTitle) || item.pageTitle || '',
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
            pageTitle: item.pageTitle,
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
            pageTitle: item.pageTitle,
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
