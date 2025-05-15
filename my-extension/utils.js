// Utility functions for the extension

// Function to share an item
function shareItem(item) {
  // Create a shareable text that includes the content and source if available
  let shareText = item.text;
  if (item.pageTitle && item.pageUrl) {
    shareText += `\n\nSource: ${item.pageTitle} (${item.pageUrl})`;
  }
  
  // Check if the Web Share API is available
  if (navigator.share) {
    navigator.share({
      title: item.pageTitle || 'Shared text',
      text: shareText,
      url: item.pageUrl
    }).catch(error => {
      console.log('Error sharing:', error);
      fallbackShare(shareText);
    });
  } else {
    fallbackShare(shareText);
  }
}

// Fallback method when Web Share API is not available
function fallbackShare(shareText) {
  // Create a temporary textarea to copy the text
  const textarea = document.createElement('textarea');
  textarea.value = shareText;
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    // Copy text and show success message
    document.execCommand('copy');
    showNotification('Copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showNotification('Failed to copy text', 'error');
  } finally {
    document.body.removeChild(textarea);
  }
}

// Function to show notifications
function showNotification(message, type = '') {
  const notification = document.createElement('div');
  notification.className = 'notification';
  if (type) notification.classList.add(type);
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove notification after 2 seconds
  setTimeout(function() {
    notification.classList.add('fade-out');
    setTimeout(function() {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}
