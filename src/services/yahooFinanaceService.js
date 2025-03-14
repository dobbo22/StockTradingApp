import axios from 'axios';

class YahooFinanceService {
  constructor() {
    this.baseURL = 'https://query1.finance.yahoo.com/v7/finance/quote';
  }

  async getStockQuotes(symbols) {
    try {
      // Ensure symbols is an array
      const symbolList = Array.isArray(symbols) ? symbols : [symbols];
      
      // Yahoo Finance requires symbols to be comma-separated
      const symbolQuery = symbolList.map(symbol => 
        symbol.includes('.') ? symbol : `${symbol}.L`  // Append .L for LSE stocks
      ).join(',');

      const response = await axios.get(this.baseURL, {
        params: {
          symbols: symbolQuery
        }
      });

      // Process the response
      const quotes = response.data.quoteResponse.result.map(quote => ({
        symbol: quote.symbol.replace('.L', ''),  // Remove .L from symbol
        name: quote.shortName,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        currency: quote.currency
      }));

      return quotes;
    } catch (error) {
      console.error('Error fetching stock quotes:', error);
      throw error;
    }
  }

  async getPortfolioValues(portfolio) {
    try {
      // Extract unique symbols from portfolio
      const symbols = [...new Set(portfolio.map(holding => holding.symbol))];
      
      // Fetch quotes for these symbols
      const quotes = await this.getStockQuotes(symbols);
      
      // Enrich portfolio with current market data
      const enrichedPortfolio = portfolio.map(holding => {
        const quote = quotes.find(q => q.symbol === holding.symbol);
        
        if (!quote) {
          return {
            ...holding,
            currentPrice: 0,
            marketValue: 0,
            profitLoss: -holding.totalCost,
            returnPercent: -100
          };
        }

        const currentPrice = parseFloat(quote.price);
        const marketValue = holding.shares * currentPrice;
        const profitLoss = marketValue - holding.totalCost;
        const returnPercent = (profitLoss / holding.totalCost) * 100;

        return {
          ...holding,
          ...quote,
          currentPrice,
          marketValue,
          profitLoss,
          returnPercent: isFinite(returnPercent) ? returnPercent : 0
        };
      });

      return enrichedPortfolio;
    } catch (error) {
      console.error('Error calculating portfolio values:', error);
      throw error;
    }
  }
}

export default new YahooFinanceService();