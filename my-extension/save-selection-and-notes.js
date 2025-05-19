/**
 * Content Script: Injects a context menu or button to save selected text.
 * Background Script: Handles storage of selected text and notes.
 * This file provides modular functions for both.
 */

// --- Content Script Part ---
// Listen for a message to get the selected text
function getSelectedText() {
  return window.getSelection().toString();
}

// Listen for context menu click or button
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    sendResponse({ selectedText: getSelectedText() });
  }
});

// --- Background Script Part ---
// Add a context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save Selected Text & Note",
    contexts: ["selection"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-selection") {
    // Get the selected text from the content script
    chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" }, (response) => {
      const selectedText = response?.selectedText || "";
      // Prompt the user for a note (using a prompt for simplicity)
      chrome.tabs.executeScript(tab.id, {
        code: `prompt("Add a note for your selection:", "")`
      }, (results) => {
        const note = results && results[0] ? results[0] : "";
        // Save both to storage
        saveSelectionAndNote(selectedText, note, tab.url);
      });
    });
  }
});

// Save to storage (can use chrome.storage or localStorage)
function saveSelectionAndNote(selectedText, note, url) {
  const entry = {
    selectedText,
    note,
    url,
    timestamp: Date.now()
  };
  chrome.storage.local.get({ selections: [] }, (result) => {
    const selections = result.selections;
    selections.push(entry);
    chrome.storage.local.set({ selections });
  });
}

// --- Optional: Function to retrieve all saved selections and notes ---
function getAllSelections(callback) {
  chrome.storage.local.get({ selections: [] }, (result) => {
    callback(result.selections);
  });
}

export { getSelectedText, saveSelectionAndNote, getAllSelections };