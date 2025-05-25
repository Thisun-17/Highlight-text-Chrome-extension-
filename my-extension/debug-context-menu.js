// Debug script to log all context menu clicks
// Add this temporarily to background.js to debug context menu issues

console.log("Debug script loaded - monitoring all context menu activity");

// Override the context menu click listener to see all clicks
const originalOnClicked = chrome.contextMenus.onClicked;
if (originalOnClicked) {
  chrome.contextMenus.onClicked.addListener(function(info, tab) {
    console.log("DEBUG: Context menu clicked:", {
      menuItemId: info.menuItemId,
      selectionText: info.selectionText,
      srcUrl: info.srcUrl,
      pageUrl: info.pageUrl,
      frameUrl: info.frameUrl
    });
  });
}

// Log when context menus are created
const originalCreate = chrome.contextMenus.create;
if (originalCreate) {
  chrome.contextMenus.create = function(createProperties, callback) {
    console.log("DEBUG: Context menu created:", createProperties);
    return originalCreate.call(this, createProperties, callback);
  };
}

// Log when context menus are removed
const originalRemove = chrome.contextMenus.remove;
if (originalRemove) {
  chrome.contextMenus.remove = function(menuItemId, callback) {
    console.log("DEBUG: Context menu removed:", menuItemId);
    return originalRemove.call(this, menuItemId, callback);
  };
}
