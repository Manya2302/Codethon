import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Calendar, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RecentNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch news from backend API (which will use GNews API)
      const response = await fetch('/api/news', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Received non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned invalid response format');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch news' }));
        throw new Error(errorData.message || 'Failed to fetch news');
      }

      const data = await response.json();
      setNews(data.articles || []);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err.message || 'Failed to load news. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading news...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load news. Please try again later.</p>
            <button
              onClick={fetchNews}
              className="mt-4 text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (news.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No news articles available at the moment.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent News</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {news.slice(0, 10).map((article, index) => (
            <div
              key={index}
              className="border-b border-border pb-4 last:border-0 last:pb-0 hover:bg-muted/50 rounded-lg p-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {article.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {article.source?.name && (
                      <Badge variant="outline" className="text-xs">
                        {article.source.name}
                      </Badge>
                    )}
                    {article.publishedAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(article.publishedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(article.image || article.urlToImage) && (
                  <img
                    src={article.image || article.urlToImage}
                    alt={article.title}
                    className="w-24 h-24 object-cover rounded-md flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  Read more
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

