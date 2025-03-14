import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/Card";
import { Alert, AlertDescription } from "../Components/ui/Alert";
import { RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const formatCurrency = (value, currency = 'GBP') => {
  if (!value && value !== 0) return '£0.00';
  try {
    return Number(value).toLocaleString('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.error('Currency formatting error:', error);
    return '£0.00';
  }
};

const PortfolioView = ({ transactions = [], stockData = [], portfolio = [] }) => {
  const [portfolioQuotes, setPortfolioQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Log input props for debugging
  useEffect(() => {
    console.group('PortfolioView Input');
    console.log('Transactions:', transactions);
    console.log('Stock Data:', stockData);
    console.log('Portfolio:', portfolio);
    console.groupEnd();
  }, [transactions, stockData, portfolio]);

  // Fetch portfolio quotes
  useEffect(() => {
    const fetchPortfolioQuotes = async () => {
      // Prioritize provided portfolio
      const holdingsToProcess = portfolio.length > 0 ? portfolio : transactions;
      
      if (holdingsToProcess.length === 0) {
        console.log('No holdings to process');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        // Use portfolio symbols or derive from transactions
        const symbols = holdingsToProcess.map(h => 
          h.symbol || h.stock_symbol || h.stockName
        ).filter(symbol => symbol); // Filter out any undefined/null/empty symbols
        
        if (symbols.length === 0) {
          throw new Error('No valid symbols found in portfolio');
        }
        
        console.log('Fetching quotes for symbols:', symbols.join(','));
        
        const response = await fetch(`${API_URL}/portfolio/quotes?symbols=${symbols.join(',')}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch portfolio quotes: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Invalid quote response: ' + (data.message || 'Unknown error'));
        }

        console.log('Quote response:', data);
        
        // Check for GBp currency in response
        const hasGbpCurrency = data.quotes?.some(q => q.currency === 'GBp');
        if (hasGbpCurrency) {
          console.log('Found GBp currency in response - will need conversion from pence to pounds');
        }
        
        // Process holdings with quote data
        const enrichedPortfolio = holdingsToProcess.map(holding => {
          // Find matching quote using various symbol formats
          const symbolWithoutSuffix = (holding.symbol || '').replace('.L', '');
          const symbolWithSuffix = symbolWithoutSuffix + '.L';
          
          const quote = data.quotes?.find(q => 
            q.symbol === holding.symbol || 
            q.symbol === symbolWithoutSuffix ||
            q.symbol === symbolWithSuffix ||
            q.symbol.replace('.L', '') === symbolWithoutSuffix
          );

          console.log(`Looking for quote match for ${holding.symbol}:`, quote);

          // Fallback price calculation with GBp to GBP conversion if needed
          let currentPrice = quote?.regularMarketPrice || quote?.price || holding.currentPrice || 0;
          
          // Convert from pence to pounds if currency is GBp
          if (quote?.currency === 'GBp') {
            console.log(`Converting ${holding.symbol} price from pence to pounds: ${currentPrice} / 100`);
            currentPrice = currentPrice / 100;
          }
          
          const shares = parseFloat(holding.shares) || 0;
          const avgPrice = parseFloat(holding.avgPrice) || 0;
          
          // Market value calculation
          const marketValue = shares * currentPrice;
          const totalCost = shares * avgPrice;
          const profitLoss = marketValue - totalCost;
          
          // Return percentage
          const returnPercent = totalCost > 0 
            ? (profitLoss / totalCost) * 100 
            : 0;

          return {
            ...holding,
            name: quote?.name || holding.name || holding.symbol,
            currentPrice,
            marketValue,
            totalCost,
            profitLoss,
            returnPercent: isFinite(returnPercent) ? returnPercent : 0
          };
        });

        console.log('Enriched Portfolio:', enrichedPortfolio);
        
        setPortfolioQuotes(enrichedPortfolio);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        console.error('Portfolio Quotes Fetch Error:', err);
        setError(`Failed to load portfolio quotes: ${err.message}`);
        setLoading(false);
      }
    };

    fetchPortfolioQuotes();
  }, [portfolio, transactions]);

  // Refresh quotes on demand
  const refreshQuotes = () => {
    setLoading(true);
    setError(null);
    // Force re-run of the useEffect
    setLastUpdated(new Date());
  };

  // Calculate total portfolio value
  const totalPortfolioValue = useMemo(() => {
    return portfolioQuotes.reduce(
      (sum, holding) => sum + (holding.marketValue || 0), 
      0
    );
  }, [portfolioQuotes]);

  return (
    <div className="container mx-auto p-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Portfolio</h2>
        <div className="flex items-center">
          <span className="text-sm text-gray-500 mr-2">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button 
            className="p-2 rounded-full hover:bg-gray-100" 
            onClick={refreshQuotes} 
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-4">
            {formatCurrency(totalPortfolioValue)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Number of Holdings</p>
              <p className="text-xl font-medium">{portfolioQuotes.length}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Most Valuable Holding</p>
              <p className="text-xl font-medium">
                {portfolioQuotes.length > 0 
                  ? portfolioQuotes.sort((a, b) => b.marketValue - a.marketValue)[0].name
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-400" />
              <p>Loading portfolio data...</p>
            </div>
          ) : portfolioQuotes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-right p-2">Shares</th>
                    <th className="text-right p-2">Avg Price</th>
                    <th className="text-right p-2">Current Price</th>
                    <th className="text-right p-2">Market Value</th>
                    <th className="text-right p-2">Profit/Loss</th>
                    <th className="text-right p-2">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioQuotes.map((holding) => (
                    <tr key={holding.symbol} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{holding.symbol}</td>
                      <td className="p-2 text-gray-600">{holding.name || holding.symbol}</td>
                      <td className="p-2 text-right">{holding.shares.toLocaleString()}</td>
                      <td className="p-2 text-right">{formatCurrency(holding.avgPrice)}</td>
                      <td className="p-2 text-right">{formatCurrency(holding.currentPrice)}</td>
                      <td className="p-2 text-right">{formatCurrency(holding.marketValue)}</td>
                      <td className={`p-2 text-right ${holding.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(holding.profitLoss)}
                      </td>
                      <td className={`p-2 text-right ${holding.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.returnPercent >= 0 ? '+' : ''}
                        {holding.returnPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No holdings found in your portfolio.</p>
              <p className="text-sm text-gray-500 mt-2">Start trading to build your portfolio.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioView;