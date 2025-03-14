// Stock details parsing utility
export const parseYahooFinanceQuoteEnhanced = (quote) => {
    if (!quote) {
      throw new Error('Invalid quote data');
    }
  
    const stockData = {
      // Basic Identification
      symbol: quote.symbol,
      name: quote.longName || quote.shortName || quote.symbol,
      exchange: quote.fullExchangeName,
  
      // Price Information
      currentPrice: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      
      // Day Trading Details
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      openPrice: quote.regularMarketOpen,
      previousClose: quote.regularMarketPreviousClose,
      
      // Volume and Trading
      volume: quote.regularMarketVolume,
      averageVolume3Month: quote.averageDailyVolume3Month,
      
      // Bid and Ask
      bid: quote.bid,
      ask: quote.ask,
      
      // Currency and Market Details
      currency: quote.currency,
      marketState: quote.marketState,
  
      // Financial Metrics
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      dividendYield: quote.dividendYield,
      
      // Price Ranges
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,
      
      // Corporate Actions
      corporateActions: quote.corporateActions?.map(action => ({
        type: action.header,
        description: action.message,
        amount: action.meta?.amount,
        date: action.meta?.dateEpochMs 
          ? new Date(action.meta.dateEpochMs).toLocaleDateString() 
          : 'N/A'
      })) || [],
      
      // Metadata
      lastUpdated: quote.regularMarketTime
        ? new Date(quote.regularMarketTime).toLocaleString()
        : 'N/A'
    };
  
    // Convert price from pence to pounds if currency is GBp
    if (stockData.currency === 'GBp') {
      const fieldsToConvert = [
        'currentPrice', 'change', 'dayHigh', 'dayLow', 
        'openPrice', 'previousClose', 'bid', 'ask',
        'fiftyTwoWeekLow', 'fiftyTwoWeekHigh'
      ];
  
      fieldsToConvert.forEach(field => {
        if (stockData[field] !== undefined && stockData[field] !== null) {
          stockData[field] = Number((stockData[field] / 100).toFixed(2));
        }
      });
    }
  
    // Round numerical fields to 2 decimal places
    const numericalFields = [
      'currentPrice', 'change', 'changePercent', 
      'dayHigh', 'dayLow', 'openPrice', 'previousClose',
      'bid', 'ask', 'dividendYield', 'peRatio',
      'fiftyTwoWeekChangePercent'
    ];
  
    numericalFields.forEach(field => {
      if (stockData[field] !== undefined && stockData[field] !== null) {
        stockData[field] = Number(stockData[field].toFixed(2));
      }
    });
  
    // Generate trading insights
    stockData.tradingInsights = generateStockRecommendation(stockData);
  
    return stockData;
  };
  
  // Generate a simple trading recommendation
  function generateStockRecommendation(stockData) {
    const insights = [];
  
    // Price trend analysis
    if (stockData.currentPrice > stockData.previousClose) {
      insights.push("Price trending upward");
    }
  
    // Volatility check
    if (Math.abs(stockData.changePercent) > 5) {
      insights.push("High daily volatility detected");
    }
  
    // Dividend yield assessment
    if (stockData.dividendYield > 3) {
      insights.push("High dividend yield attractive for income investors");
    }
  
    // Valuation metrics
    if (stockData.peRatio && stockData.peRatio < 15) {
      insights.push("Potentially undervalued");
    }
  
    // Generate overall recommendation
    const positiveFactors = insights.length;
    let recommendation = 'NEUTRAL';
  
    if (positiveFactors >= 3) recommendation = 'BUY';
    if (positiveFactors <= 1) recommendation = 'SELL';
  
    return {
      recommendation,
      insights
    };
  }
  
  // Process multiple stock quotes
  export const processYahooFinanceQuotes = (response) => {
    try {
      if (!response || !response.result) {
        throw new Error('Invalid quote response');
      }
  
      const processedStocks = response.result.map(parseYahooFinanceQuoteEnhanced);
      return {
        success: true,
        stocks: processedStocks
      };
    } catch (error) {
      console.error('Error processing Yahoo Finance quotes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };