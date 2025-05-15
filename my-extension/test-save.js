// This is a test file to manually run the store selected text action
// Paste this in your browser console when testing

function storeSelectedText() {
  const selection = window.getSelection();
  if (selection && selection.toString().trim() !== '') {
    const selectedText = selection.toString();
    console.log("Selected text:", selectedText);
    
    // Store directly in chrome.storage
    chrome.storage.local.set({ 'currentSelectedText': selectedText }, function() {
      console.log("Saved selected text to storage:", selectedText);
    });
  } else {
    console.log("No text selected");
  }
}

// Call this function manually from the browser console
// storeSelectedText();
