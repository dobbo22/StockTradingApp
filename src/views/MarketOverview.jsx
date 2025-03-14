import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/Card";
import { TrendingUp, TrendingDown } from 'lucide-react';

// Create a function to generate a stable key for stock data comparison
const getStockDataKey = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return '';
  return JSON.stringify(data.map(stock => `${stock.symbol}:${stock.price}:${stock.changePercentage}`));
};

// Memoize the entire component to prevent re-renders
const MarketOverview = React.memo(({ stockData = [] }) => {
  // Save a stable reference to the stockData
  const [stableStockData, setStableStockData] = useState([]);
  
  // Create a stable dependency key
  const stockDataKey = useMemo(() => getStockDataKey(stockData), [stockData]);
  
  // Only update when stockData has meaningful changes
  useEffect(() => {
    if (stockData && stockData.length > 0) {
      console.log("MarketOverview: Updating stableStockData", stockData.length);
      setStableStockData(stockData);
    }
  }, [stockDataKey, stockData]); // Added stockData to satisfy ESLint
  
  // Calculate gainers and losers with useMemo to prevent recalculation
  const { gainers, losers } = useMemo(() => {
    console.log("MarketOverview: Calculating gainers and losers");
    
    if (!stableStockData || !stableStockData.length) {
      return { gainers: [], losers: [] };
    }

    try {
      // Safely parse percentages with error handling
      const safeParseFloat = (value) => {
        if (value === null || value === undefined) return 0;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      // Filter and sort gainers and losers with safety checks
      const processedGainers = stableStockData
        .filter(stock => stock && safeParseFloat(stock.changePercentage) > 0)
        .sort((a, b) => safeParseFloat(b.changePercentage) - safeParseFloat(a.changePercentage))
        .slice(0, 5);
        
      const processedLosers = stableStockData
        .filter(stock => stock && safeParseFloat(stock.changePercentage) <= 0)
        .sort((a, b) => safeParseFloat(a.changePercentage) - safeParseFloat(b.changePercentage))
        .slice(0, 5);
        
      return { 
        gainers: processedGainers, 
        losers: processedLosers 
      };
    } catch (error) {
      console.error('Error processing market data:', error);
      return { gainers: [], losers: [] };
    }
  }, [stableStockData]); // Only depends on stableStockData
  
  // Pre-calculate stock lists to avoid calculations in render
  const gainersDisplay = useMemo(() => {
    return <StockList stocks={gainers} type="gainers" />;
  }, [gainers]);
  
  const losersDisplay = useMemo(() => {
    return <StockList stocks={losers} type="losers" />;
  }, [losers]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Movers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {gainersDisplay}
          {losersDisplay}
        </div>
      </CardContent>
    </Card>
  );
});

// Separate StockList component to isolate renders
const StockList = React.memo(({ stocks, type }) => {
  // Safely format percentage value
  const formatPercentage = (value) => {
    try {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return '0.00%';
      return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
    } catch (e) {
      return '0.00%';
    }
  };
  
  // Safely format currency
  const formatCurrency = (value, currency = 'GBP') => {
    try {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return '£0.00';
      
      return numValue.toLocaleString('en-GB', { 
        style: 'currency', 
        currency: currency 
      });
    } catch (e) {
      return '£0.00';
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        {type === 'gainers' ? (
          <TrendingUp className="h-5 w-5 text-green-500" />
        ) : (
          <TrendingDown className="h-5 w-5 text-red-500" />
        )}
        <h3 className="text-lg font-semibold">
          {type === 'gainers' ? 'Top Gainers' : 'Top Losers'}
        </h3>
      </div>
      
      {stocks.length > 0 ? (
        <div className="space-y-3">
          {stocks.map((stock) => (
            <div key={stock.symbol} className="flex justify-between items-start border-b pb-2">
              <div>
                {/* Show name first, then symbol in parentheses */}
                <p className="font-medium">
                  {stock.name || 'Unknown'}
                  <span className="text-sm text-gray-500 ml-1">({stock.symbol})</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {formatCurrency(stock.price, stock.currency || 'GBP')}
                </div>
                <div className={`text-sm ${parseFloat(stock.changePercentage) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(stock.changePercentage)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No data available</p>
      )}
    </div>
  );
});

export default MarketOverview;