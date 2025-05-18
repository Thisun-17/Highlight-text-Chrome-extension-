// Extract full page content for saving
window.extractFullPageContent = function() {
  try {
    const getMetaContent = (name) => {
      const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`);
      return meta ? meta.getAttribute("content") : null;
    };
    
    // Extract metadata from the page
    const pageTitle = document.title || '';
    const pageDescription = getMetaContent("description") || '';
    const pageUrl = window.location.href;
    const siteName = getMetaContent("site_name") || window.location.hostname;
    
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
    
    let mainContent = '';
    let articleElement = null;
    
    // Try each selector until we find a match
    for (const selector of possibleArticleSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Pick the element with the most text content
        articleElement = Array.from(elements).sort((a, b) => 
          b.textContent.trim().length - a.textContent.trim().length
        )[0];
        
        if (articleElement) {
          mainContent = articleElement.textContent.trim();
          break;
        }
      }
    }
    
    // If no article element was found, use the body as fallback
    if (!mainContent) {
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
        elements.forEach(element => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      });
      
      mainContent = bodyClone.textContent.trim();
    }
    
    // Clean up the content
    mainContent = mainContent
      .replace(/[\t\n]+/g, '\n')  // Replace tabs and multiple newlines
      .replace(/\s{2,}/g, ' ')    // Replace multiple spaces
      .trim();
    
    // Get a short excerpt for display
    const excerpt = mainContent.substring(0, 150) + (mainContent.length > 150 ? '...' : '');
      return {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      pageUrl: pageUrl,  // Adding pageUrl for consistency
      siteName: siteName,
      content: mainContent,
      excerpt: excerpt,
      savedAt: new Date().toISOString(),
      type: 'fullpage'
    };
  } catch (e) {
    console.error('Error extracting page content:', e);    return {
      error: e.message,
      title: document.title,
      url: window.location.href,
      pageUrl: window.location.href, // Adding pageUrl for consistency
      excerpt: 'Error extracting content'
    };
  }
}
