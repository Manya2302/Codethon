import GNews from '@gnews-io/gnews-io-js';

// News service with caching and refresh functionality
let cachedNews = {
  articles: [],
  lastUpdated: null,
  isRefreshing: false
};

// Initialize GNews client (will be initialized with API key when needed)
let gnewsClient = null;

/**
 * Initialize GNews client
 */
function getGNewsClient() {
  const apiKey = process.env.NEWS_API_KEY;
  
  if (!apiKey) {
    throw new Error('News API key not configured');
  }

  if (!gnewsClient) {
    gnewsClient = new GNews(apiKey);
  }
  
  return gnewsClient;
}

/**
 * Fetch news from GNews API - tries package first, falls back to direct HTTP
 */
export async function fetchNewsFromAPI() {
  const apiKey = process.env.NEWS_API_KEY;
  
  if (!apiKey) {
    throw new Error('News API key not configured');
  }
  
  console.log('🔑 Using GNews API key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');
  
  // Try using the GNews package first
  try {
    const gnews = getGNewsClient();
    
    console.log('📦 Attempting to fetch news using GNews package...');
    
    // Fetch Ahmedabad Real Estate news from GNews API for India
    const newsData = await gnews.search('Ahmedabad Real Estate', {
      lang: 'en',
      country: 'in',
      max: 10
    });
    
    console.log('📰 GNews package response received:', {
      hasData: !!newsData,
      type: typeof newsData,
      keys: newsData ? Object.keys(newsData) : null,
      articlesCount: newsData?.articles?.length || 0
    });
    
    // GNews package returns articles directly
    if (newsData && newsData.articles && Array.isArray(newsData.articles)) {
      return newsData;
    } else if (newsData && Array.isArray(newsData)) {
      // Some versions might return articles array directly
      return { articles: newsData };
    }
  } catch (packageError) {
    console.warn('⚠️ GNews package failed, trying direct HTTP API:', packageError.message);
    
    // Fallback to direct HTTP API call
    try {
      console.log('🌐 Attempting direct HTTP API call...');
      
      // Use the direct API URL format as provided by user
      const newsUrl = `https://gnews.io/api/v4/search?q=Ahmedabad+Real+Estate&lang=en&country=in&max=10&apikey=${apiKey}`;
      
      const newsResponse = await fetch(newsUrl);
      
      if (!newsResponse.ok) {
        const errorText = await newsResponse.text();
        console.error('❌ HTTP API error response:', errorText);
        throw new Error(`GNews API returned status ${newsResponse.status}: ${errorText.substring(0, 100)}`);
      }

      const newsData = await newsResponse.json();
      
      console.log('📰 Direct HTTP API response received:', {
        hasData: !!newsData,
        articlesCount: newsData?.articles?.length || 0
      });
      
      // GNews API returns articles directly in the response
      if (newsData.articles && Array.isArray(newsData.articles)) {
        return newsData;
      } else {
        throw new Error(newsData.message || 'Failed to fetch news');
      }
    } catch (httpError) {
      console.error('❌ Both GNews package and HTTP API failed');
      console.error('Package error:', packageError.message);
      console.error('HTTP error:', httpError.message);
      
      // Provide helpful error messages
      if (httpError.message && httpError.message.includes('403')) {
        throw new Error('GNews API: Authentication failed (403). Please verify your API key is valid for GNews.io');
      } else if (httpError.message && httpError.message.includes('401')) {
        throw new Error('GNews API: Unauthorized (401). Invalid API key.');
      } else if (httpError.message && httpError.message.includes('429')) {
        throw new Error('GNews API: Rate limit exceeded (429). Please try again later.');
      } else {
        throw new Error(`Failed to fetch news: ${httpError.message || packageError.message}`);
      }
    }
  }
}

/**
 * Refresh news cache
 */
export async function refreshNewsCache() {
  if (cachedNews.isRefreshing) {
    console.log('News refresh already in progress, skipping...');
    return;
  }

  try {
    cachedNews.isRefreshing = true;
    console.log('🔄 Refreshing news cache...');
    
    const newsData = await fetchNewsFromAPI();
    
    cachedNews.articles = newsData.articles || [];
    cachedNews.lastUpdated = new Date();
    
    console.log(`✅ News cache refreshed successfully. ${cachedNews.articles.length} articles cached.`);
    console.log(`📅 Last updated: ${cachedNews.lastUpdated.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error refreshing news cache:', error.message);
    // Keep old cache if refresh fails
  } finally {
    cachedNews.isRefreshing = false;
  }
}

/**
 * Get cached news
 */
export function getCachedNews() {
  return {
    articles: cachedNews.articles,
    lastUpdated: cachedNews.lastUpdated,
    totalArticles: cachedNews.articles.length
  };
}

/**
 * Get news - returns cached if available, otherwise fetches fresh
 */
export async function getNews() {
  // If cache is empty or very old (more than 24 hours), refresh
  const cacheAge = cachedNews.lastUpdated 
    ? Date.now() - cachedNews.lastUpdated.getTime()
    : Infinity;
  
  const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  if (cachedNews.articles.length === 0 || cacheAge > maxCacheAge) {
    console.log('📰 Cache empty or expired, fetching fresh news...');
    try {
      await refreshNewsCache();
    } catch (error) {
      console.error('Error refreshing cache in getNews:', error);
      // Return empty articles if refresh fails and cache is empty
      if (cachedNews.articles.length === 0) {
        return {
          articles: [],
          lastUpdated: null,
          totalArticles: 0
        };
      }
    }
  }
  
  return getCachedNews();
}

