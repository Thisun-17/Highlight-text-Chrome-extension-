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
    
    // Get main image - first try OpenGraph image
    let mainImage = getMetaContent("og:image") || getMetaContent("twitter:image");
    
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
      // If no OpenGraph image, try to find the largest image in the article content
    if (!mainImage && articleElement) {
      const images = articleElement.querySelectorAll('img');
      let largestImage = null;
      let largestArea = 0;
      
      images.forEach(img => {
        if (img.naturalWidth && img.naturalHeight) {
          const area = img.naturalWidth * img.naturalHeight;
          if (area > largestArea && area > 10000) { // Ignore tiny images
            largestArea = area;
            largestImage = img;
          }
        }
      });
      
      if (largestImage && largestImage.src) {
        mainImage = largestImage.src;
      }
    }
    
    // If still no image, look for hero/banner images throughout the page
    if (!mainImage) {
      const possibleHeroImages = document.querySelectorAll('header img, .hero img, .banner img, .featured-image img');
      if (possibleHeroImages.length > 0) {
        mainImage = possibleHeroImages[0].src;
      }
    }
    
    // As a fallback, get any large image from the page
    if (!mainImage) {
      const allImages = document.querySelectorAll('img');
      const largeImages = Array.from(allImages).filter(img => 
        img.naturalWidth > 300 && img.naturalHeight > 200 && !img.src.includes('avatar') && !img.src.includes('icon')
      );
      
      if (largeImages.length > 0) {
        // Sort by size (largest first)
        largeImages.sort((a, b) => 
          (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight)
        );
        mainImage = largeImages[0].src;
      }
    }
    
    return {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      siteName: siteName,
      content: mainContent,
      excerpt: excerpt,
      savedAt: new Date().toISOString(),
      type: 'fullpage',
      imageUrl: mainImage || null
    };
  } catch (e) {
    console.error('Error extracting page content:', e);
    return {
      error: e.message,
      title: document.title,
      url: window.location.href,
      excerpt: 'Error extracting content'
    };
  }
}
