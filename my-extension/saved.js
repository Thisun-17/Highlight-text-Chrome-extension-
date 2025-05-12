// Code for handling saved items display
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('items-container');
  
  // Get saved items from storage
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    
    if (savedItems.length === 0) {
      container.innerHTML = '<div class="empty-state">No saved items yet</div>';
      return;
    }
    
    // Display items in reverse chronological order
    savedItems.reverse().forEach(function(item) {
      const itemElement = document.createElement('div');
      itemElement.className = 'item';
      
      const dateElement = document.createElement('div');
      dateElement.className = 'item-date';
      dateElement.textContent = new Date(item.date).toLocaleString();
      
      const contentElement = document.createElement('div');
      
      if (item.type === 'text') {
        contentElement.textContent = item.content.text || item.content;
        
        // Add source info if available
        if (item.content.pageUrl && item.content.pageTitle) {
          const sourceElement = document.createElement('div');
          sourceElement.className = 'item-source';
          const sourceLink = document.createElement('a');
          sourceLink.href = item.content.pageUrl;
          sourceLink.textContent = item.content.pageTitle;
          sourceLink.target = '_blank';
          sourceElement.appendChild(document.createTextNode('Source: '));
          sourceElement.appendChild(sourceLink);
          contentElement.appendChild(sourceElement);
        }
      } 
      else if (item.type === 'highlight') {
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-text';
        highlightElement.textContent = item.content.text;
        highlightElement.style.backgroundColor = item.content.color || '#ffff00';
        
        contentElement.appendChild(highlightElement);
        
        // Add source info
        if (item.content.pageUrl && item.content.pageTitle) {
          const sourceElement = document.createElement('div');
          sourceElement.className = 'item-source';
          const sourceLink = document.createElement('a');
          sourceLink.href = item.content.pageUrl;
          sourceLink.textContent = item.content.pageTitle;
          sourceLink.target = '_blank';
          sourceElement.appendChild(document.createTextNode('Highlighted from: '));
          sourceElement.appendChild(sourceLink);
          contentElement.appendChild(sourceElement);
        }
      }
      else if (item.type === 'image') {
        contentElement.className = 'item-image';
        const img = document.createElement('img');
        img.src = item.content;
        contentElement.appendChild(img);
      } 
      else if (item.type === 'article') {
        const link = document.createElement('a');
        link.href = item.content.url;
        link.textContent = item.content.title;
        link.target = '_blank';
        contentElement.appendChild(link);
      }
      
      itemElement.appendChild(dateElement);
      itemElement.appendChild(contentElement);
      container.appendChild(itemElement);
    });
  });
});
