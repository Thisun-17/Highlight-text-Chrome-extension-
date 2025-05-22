// Merged background.js: combines all logic from background-fixed.js and background.js
// Set up context menu items when extension is installed
chrome.runtime.onInstalled.addListener(function() {
  console.log("Data FlowX extension installed/updated");
  // Create context menu items
  chrome.contextMenus.create({
    id: "saveText",
    title: "Save Text",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "saveImage",
    title: "Save This Image",
    contexts: ["image"]
  });
  chrome.contextMenus.create({
    id: "saveArticle",
    title: "Save This Article",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "saveFullPage",
    title: "Save Full Page Content",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "restoreHighlights",
    title: "Restore All Highlights",
    contexts: ["page"]
  });
});

// Listen for tab updates to restore highlights when page loads
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log('Tab updated and completed loading:', tab.url);
    setTimeout(() => {
      console.log('Sending restoreHighlights message to tab:', tabId);
      chrome.tabs.sendMessage(tabId, {
        action: 'restoreHighlights',
        url: tab.url
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Error restoring highlights:', chrome.runtime.lastError.message);
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
          }, function() {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                action: 'restoreHighlights',
                url: tab.url
              });
            }, 500);
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                action: 'restoreHighlights',
                url: tab.url
              });
            }, 2000);
          });
        } else {
          console.log('Restore highlights message sent successfully');
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: 'restoreHighlights',
              url: tab.url
            });
          }, 2000);
        }
      });
    }, 1000);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log("Context menu clicked:", info.menuItemId);
  if (info.menuItemId === "saveText" && info.selectionText) {
    const highlightId = 'highlight-' + Date.now();
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        action: "highlightSelectedText",
        highlightId: highlightId,
        color: "#90EE90",
        selectionText: info.selectionText
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error("Chrome runtime error:", chrome.runtime.lastError);
        }
        if (response && response.success) {
          saveToStorage('text', {
            text: info.selectionText,
            pageUrl: tab.url,
            pageTitle: tab.title,
            highlightId: highlightId
          }, function() {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Text Saved',
              message: 'The selected text has been saved and highlighted.'
            });
          });
        } else {
          saveToStorage('text', {
            text: info.selectionText,
            pageUrl: tab.url,
            pageTitle: tab.title
          }, function() {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Text Saved',
              message: 'The text has been saved (highlighting failed).'
            });
          });
        }
      });
    }, 50);
  } else if (info.menuItemId === "saveImage" && info.srcUrl) {
    saveToStorage('image', info.srcUrl, function() {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Image Saved',
        message: 'The image has been saved.'
      });
    });
  } else if (info.menuItemId === "saveArticle") {
    chrome.tabs.executeScript(tab.id, {
      code: `{
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';
        const articleText = document.querySelector('article')?.textContent?.substring(0, 200) + '...' || '';
        {
          betterTitle: ogTitle || document.title,
          description: ogDescription || metaDescription || articleText,
          url: window.location.href,
          pageTitle: document.title
        }
      }`
    }, function(results) {
      let articleData = {
        url: tab.url,
        title: tab.title,
        pageTitle: tab.title,
        text: tab.title
      };
      if (results && results[0]) {
        const pageData = results[0];
        articleData = {
          url: pageData.url || tab.url,
          title: pageData.betterTitle || tab.title,
          pageTitle: pageData.pageTitle || tab.title,
          text: pageData.description || tab.title,
          pageUrl: pageData.url || tab.url
        };
      }
      saveToStorage('article', articleData, function() {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Article Saved',
          message: 'This article has been saved.'
        });
      });
    });
  } else if (info.menuItemId === "saveFullPage") {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: function() {
        try {
          const getMetaContent = (name) => {
            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`);
            return meta ? meta.getAttribute("content") : null;
          };
          const pageTitle = document.title || '';
          const pageDescription = getMetaContent("description") || '';
          const pageUrl = window.location.href;
          const siteName = getMetaContent("site_name") || window.location.hostname;
          const possibleArticleSelectors = [
            'article', '[role="article"]', '.article', '.post-content', '.entry-content',
            '.content', 'main', '#main', '.main-content', '.post', '.blog-post'
          ];
          let mainContent = '';
          let articleElement = null;
          for (const selector of possibleArticleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElement = Array.from(elements).sort((a, b) => 
                b.textContent.trim().length - a.textContent.trim().length
              )[0];
              if (articleElement) {
                mainContent = articleElement.textContent.trim();
                break;
              }
            }
          }
          if (!mainContent) {
            const nonContentSelectors = [
              'header', 'footer', 'nav', 'aside', '.header', '.footer', '.nav', '.sidebar',
              '.comments', '.menu', '.navigation', '[role="banner"]', '[role="navigation"]'
            ];
            const bodyClone = document.body.cloneNode(true);
            nonContentSelectors.forEach(selector => {
              const elements = bodyClone.querySelectorAll(selector);
              elements.forEach(el => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
              });
            });
            mainContent = bodyClone.textContent.trim();
          }
          mainContent = mainContent
            .replace(/[\t\n]+/g, '\n')
            .replace(/\s{2,}/g, ' ')
            .trim();
          const excerpt = mainContent.substring(0, 150) + (mainContent.length > 150 ? '...' : '');
          return {
            title: pageTitle,
            description: pageDescription,
            url: pageUrl,
            pageUrl: pageUrl,
            siteName: siteName,
            content: mainContent,
            excerpt: excerpt,
            savedAt: new Date().toISOString(),
            type: 'fullpage'
          };
        } catch (e) {
          console.error('Error extracting page content:', e);
          return { error: e.message, title: document.title, url: window.location.href, pageUrl: window.location.href };
        }
      }
    }, function(results) {
      if (results && results[0] && results[0].result && !results[0].result.error) {
        const fullPageData = results[0].result;
        if (fullPageData.url) {
          fullPageData.pageUrl = fullPageData.pageUrl || fullPageData.url;
        } else if (fullPageData.pageUrl) {
          fullPageData.url = fullPageData.url || fullPageData.pageUrl;
        }
        saveToStorage('fullpage', fullPageData, function() {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Full Page Saved',
            message: 'The entire page content has been saved.'
          });
        });
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Error Saving Page',
          message: 'Could not extract the page content.'
        });
      }
    });
  } else if (info.menuItemId === "restoreHighlights") {
    chrome.tabs.sendMessage(tab.id, {
      action: "restoreHighlights",
      url: tab.url
    }, function(response) {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        }, function() {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: "restoreHighlights",
              url: tab.url
            });
          }, 500);
        });
      }
    });
  }
});

let lastSelectedText = '';

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("Background script received message:", message.action);
  if (message.action === "saveSelectedText" && message.text) {
    lastSelectedText = message.text;
    chrome.storage.local.set({ 'currentSelectedText': message.text }, function() {});
    sendResponse({success: true});
  } else if (message.action === "clearSelectedText") {
    lastSelectedText = '';
    chrome.storage.local.remove('currentSelectedText', function() {});
    sendResponse({success: true});
  } else if (message.action === "getSelectedText") {
    if (!lastSelectedText) {
      chrome.storage.local.get(['currentSelectedText'], function(result) {
        if (result && result.currentSelectedText) {
          lastSelectedText = result.currentSelectedText;
          sendResponse({text: lastSelectedText});
        } else {
          sendResponse({text: ""});
        }
      });
      return true;
    }
    sendResponse({text: lastSelectedText});
  } else if (message.action === "executeContextMenuAction" && message.menuItemId === "saveFullPage") {
    chrome.tabs.get(message.tabId, function(tab) {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, error: chrome.runtime.lastError.message});
        return;
      }
      chrome.contextMenus.onClicked.dispatchEvent(
        new CustomEvent('click', {
          detail: {
            menuItemId: "saveFullPage",
            tab: tab
          }
        })
      );
      sendResponse({success: true});
    });
    return true;
  }
});

function saveToStorage(type, content, callback) {
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    const isDuplicate = checkForDuplicate(savedItems, type, content);
    if (isDuplicate) {
      if (callback) callback();
      return;
    }
    const item = {
      id: 'item-' + Date.now(),
      type: type,
      content: content,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString()
    };
    savedItems.push(item);
    chrome.storage.local.set({savedItems: savedItems}, function() {
      if (callback) callback();
    });
  });
}

function checkForDuplicate(savedItems, type, content) {
  if (type === 'text') {
    return savedItems.some(item => {
      if (item.type === 'text' && 
          item.content && 
          item.content.text === content.text &&
          item.content.pageUrl === content.pageUrl) {
        return true;
      }
      return false;
    });
  }
  if (type === 'article') {
    return savedItems.some(item => 
      item.type === 'article' && 
      item.content && 
      item.content.url === content.url
    );
  }
  if (type === 'image') {
    return savedItems.some(item => 
      item.type === 'image' && 
      item.content === content
    );
  }
  if (type === 'fullpage') {
    return savedItems.some(item => 
      item.type === 'fullpage' && 
      item.content && 
      item.content.url === content.url
    );
  }
  return false;
}
