import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/Card";
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Info,
  DollarSign,
  BarChart2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Format large numbers to readable format
const formatLargeNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';

  const absNum = Math.abs(num);

  if (absNum >= 1e12) {
    return (num / 1e12).toFixed(2) + 'T';
  } else if (absNum >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  } else {
    return num.toString();
  }
};

// Add this helper function near the top of your file with other utility functions
const convertGBXtoGBP = (value, currency) => {
  if (!value && value !== 0) return 0;

  // Check if the currency is in pence (GBX) and convert to pounds (GBP)
  if (currency === 'GBX' || currency === 'GBp') {
    return value / 100;
  }
  return value;
};

// Add a utility function to safely render potentially complex values
const safeRender = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return 'Complex Object';
    }
  }

  return value.toString();
};

// Then modify your formatCurrency function to use this conversion
const formatCurrency = (value, currency = 'GBP') => {
  if (!value && value !== 0) return '£0.00';
  try {
    // Convert from pence to pounds if needed
    const convertedValue = convertGBXtoGBP(value, currency);

    return Number(convertedValue).toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP', // Always format as GBP
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.error('Currency formatting error:', error);
    return '£0.00';
  }
};

// Generate a more sophisticated recommendation based on stock data
const generateRecommendation = (stockData) => {
  if (!stockData) return 'NEUTRAL';

  const changePercent = stockData.changePercent || 0;
  const previousClose = stockData.previousClose || 0;
  const currentPrice = stockData.regularMarketPrice || stockData.price || 0;

  // More detailed algorithm that considers multiple factors
  let score = 0;

  // Momentum factor
  if (changePercent > 3) score += 2;
  else if (changePercent > 1) score += 1;
  else if (changePercent < -3) score -= 2;
  else if (changePercent < -1) score -= 1;

  // Price relative to previous close
  if (currentPrice > previousClose * 1.05) score += 1; // 5% above previous close
  else if (currentPrice < previousClose * 0.95) score -= 1; // 5% below previous close

  // Volume consideration (if available)
  if (stockData.volume && stockData.avgVolume) {
    const volumeRatio = stockData.volume / stockData.avgVolume;
    if (volumeRatio > 1.5 && changePercent > 0) score += 1; // High volume on positive day
    else if (volumeRatio > 1.5 && changePercent < 0) score -= 1; // High volume on negative day
  }

  // Convert score to recommendation
  if (score >= 2) return 'BUY';
  if (score <= -2) return 'SELL';
  return 'NEUTRAL';
};

// Generate enhanced insights based on stock and profile data
const generateInsights = (stockData, companyData = null) => {
  const insights = [];

  if (!stockData) return insights;

  const changePercent = stockData.changePercent || 0;
  // Remove unused previousClose variable
  const currentPrice = stockData.regularMarketPrice || stockData.price || 0;

  // Market performance insights
  if (changePercent > 0) {
    insights.push(`Up ${changePercent.toFixed(2)}% today`);
  } else if (changePercent < 0) {
    insights.push(`Down ${Math.abs(changePercent).toFixed(2)}% today`);
  }

  // Volume insights
  if (stockData.volume) {
    const volumeFormatted = Number(stockData.volume).toLocaleString();
    if (stockData.avgVolume) {
      const volumeRatio = stockData.volume / stockData.avgVolume;
      if (volumeRatio > 1.5) {
        insights.push(`High volume (${volumeFormatted}) - ${Math.round(volumeRatio * 100)}% of average`);
      } else if (volumeRatio < 0.5) {
        insights.push(`Low volume (${volumeFormatted}) - ${Math.round(volumeRatio * 100)}% of average`);
      } else {
        insights.push(`Volume: ${volumeFormatted}`);
      }
    } else {
      insights.push(`Volume: ${volumeFormatted}`);
    }
  }

  // 52-week range context
  if (stockData.fiftyTwoWeekHigh && stockData.fiftyTwoWeekLow) {
    const rangePosition = (currentPrice - stockData.fiftyTwoWeekLow) /
                          (stockData.fiftyTwoWeekHigh - stockData.fiftyTwoWeekLow);

    if (rangePosition > 0.9) {
      insights.push('Trading near 52-week high');
    } else if (rangePosition < 0.1) {
      insights.push('Trading near 52-week low');
    } else {
      insights.push(`${Math.round(rangePosition * 100)}% of 52-week range`);
    }
  }

  // Add sector/industry context if available
  if (companyData?.sector && companyData.sector !== 'N/A') {
    insights.push(`Sector: ${companyData.sector}`);
  }

  // Add market cap context if available
  if (stockData.marketCap) {
    let marketCapLabel = '';
    const marketCap = parseFloat(stockData.marketCap);

    if (marketCap >= 10e9) {
      marketCapLabel = 'Large Cap';
    } else if (marketCap >= 2e9) {
      marketCapLabel = 'Mid Cap';
    } else if (marketCap >= 300e6) {
      marketCapLabel = 'Small Cap';
    } else {
      marketCapLabel = 'Micro Cap';
    }

    insights.push(marketCapLabel);
  }

  return insights;
};

const TradingView = ({ cash, onTrade }) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [stockDetails, setStockDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const searchRef = useRef(null);
  // Search for stocks by name or symbol using Yahoo Finance API
  const searchStocks = async () => {
    if (!searchInput.trim()) return;

    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      // Yahoo Finance API endpoint for search (use our proxy endpoint)
      const yahooSearchUrl = `${API_URL}/yahoo/search?query=${encodeURIComponent(searchInput)}`;

      const response = await fetch(yahooSearchUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.quotes && data.quotes.length > 0) {
        // Filter out non-equity results and focus on UK stocks
        const ukStocks = data.quotes.filter(item =>
          (item.quoteType === 'EQUITY') &&
          (item.exchange === 'LSE' || item.symbol.endsWith('.L'))
        );

        if (ukStocks.length > 0) {
          // Stock name mappings for common UK stocks when proper name is missing
          const stockNameMappings = {
            'TSCO.L': 'Tesco PLC',
            'BARC.L': 'Barclays PLC',
            'LLOY.L': 'Lloyds Banking Group PLC',
            'BP.L': 'BP PLC',
            'HSBA.L': 'HSBC Holdings PLC',
            'VOD.L': 'Vodafone Group PLC',
            'GSK.L': 'GSK PLC',
            'AZN.L': 'AstraZeneca PLC',
            'ULVR.L': 'Unilever PLC',
            'SHEL.L': 'Shell PLC',
            'NWG.L': 'NatWest Group PLC',
            'STAN.L': 'Standard Chartered PLC',
            'RIO.L': 'Rio Tinto PLC',
            'BT-A.L': 'BT Group PLC',
            'IAG.L': 'International Consolidated Airlines Group SA',
            'OCDO.L': 'Ocado Group PLC',
            'SAGE.L': 'The Sage Group PLC'
            // Add more common stocks as needed
          };

          const formattedResults = ukStocks.map(stock => {
            // Determine the display name
            let displayName = stock.shortName || stock.longName;

            // Check if the name is missing or same as symbol
            if (!displayName || displayName === stock.symbol || displayName === stock.symbol.replace('.L', '')) {
              // Use known mapping if available, otherwise create a generic company name
              displayName = stockNameMappings[stock.symbol] ||
                           (stock.symbol.replace('.L', '') + ' PLC');
            }

            return {
              symbol: stock.symbol,
              name: displayName,
              exchange: stock.exchange || 'LSE',
              sector: stock.sector || 'N/A',
              industry: stock.industry || 'N/A',
              currency: stock.currency || 'GBP'
            };
          });

          console.log("Formatted search results:", formattedResults);
          setSearchResults(formattedResults);
        } else {
          setError('No UK stocks found matching your search. Try a different name or symbol.');
        }
      } else {
        setError('No stocks found matching your search. Try a different name or symbol.');
      }
    } catch (err) {
      console.error('Stock search error:', err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  // Clear search results when input changes
  useEffect(() => {
    if (searchInput.trim() === '') {
      setSearchResults([]);
    }
  }, [searchInput]);

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchStocks();
  };

  // Handle trade submission
  const handleTradeSubmission = (type) => {
    if (!stockDetails) {
      setError('Please search for a stock first');
      return;
    }

    // Calculate total cost using ask price for buy and bid price for sell
    const tradePrice = type === 'BUY' ? stockDetails.askPrice : stockDetails.bidPrice;
    const totalCost = tradePrice * quantity;

    // Validate trade
    if (type === 'BUY' && totalCost > cash) {
      setError(`Insufficient funds. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(cash)} available.`);
      return;
    }

    // Perform the trade
    onTrade({
      symbol: stockDetails.symbol,
      type,
      price: tradePrice,
      quantity
    });

    // Reset state after successful trade
    setStockDetails(null);
    setQuantity(1);
    setError('');
  };

  // Fetch stock details function
  const fetchStockDetails = async (symbol) => {
    setLoading(true);
    setError(null);
    setSearchResults([]); // Clear search results

    try {
      // Ensure symbol has .L suffix for UK stocks if not already present
      const formattedSymbol = symbol.includes('.')
        ? symbol
        : `${symbol}.L`;

      // Strip the .L from the symbol to match your database
      const baseSymbol = formattedSymbol.replace('.L', '');

      // First, attempt to fetch company data from your local database
      console.log(`Fetching company profile for symbol: ${baseSymbol}`);
      const companyProfileUrl = `${API_URL}/stocks/profiles/${baseSymbol}`;

      let companyProfile = null;
      let companyImage = null;

      try {
        const companyResponse = await fetch(companyProfileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (companyResponse.ok) {
          const profileData = await companyResponse.json();
          console.log("Company profile API response:", profileData);

          if (profileData.success && profileData.profile) {
            companyProfile = profileData.profile;
            companyImage = profileData.profile.image;
            console.log("Company image found:", companyImage);
          } else {
            console.warn("Company profile API returned success=false or empty profile");
          }
        } else {{/* Trading Recommendation */}
        <div className="p-3 rounded-md bg-gray-50">
          <div className="flex items-center mb-2">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
            <h3 className="font-medium">Trading Recommendation</h3>
          </div>
          <p className={`text-xl font-bold ${
            tradingInsights.recommendation === 'BUY'
              ? 'text-green-600'
              : tradingInsights.recommendation === 'SELL'
              ? 'text-red-600'
              : 'text-gray-600'
          }`}>
            {tradingInsights.recommendation}
          </p>
        </div>

        {/* Insights */}
        {tradingInsights.insights && tradingInsights.insights.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="flex items-center mb-2">
              <Info className="w-5 h-5 mr-2 text-blue-500" />
              <h3 className="font-medium">Trading Insights</h3>
            </div>
            <ul className="space-y-2">
              {tradingInsights.insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cost Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-500">Trade Cost</p>
                <p className="text-lg font-medium">
                  {formatCurrency(stockDetails.currentPrice * quantity, stockDetails.currency)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-500">Available Cash</p>
                <p className="text-lg font-medium">
                  {formatCurrency(cash, 'GBP')}
                </p>
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-4">
            {/* Key Stock Statistics */}
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <BarChart2 className="w-5 h-5 mr-2 text-blue-500" />
                Key Statistics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Previous Close</p>
                  <p className="font-medium">{formatCurrency(stockDetails.previousClose, stockDetails.currency)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Open</p>
                  <p className="font-medium">{formatCurrency(stockDetails.open, stockDetails.currency)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Volume</p>
                  <p className="font-medium">{Number(stockDetails.volume).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Market Cap</p>
                  <p className="font-medium">
                    {stockDetails.marketCap ? 
                      `${formatLargeNumber(stockDetails.marketCap)}` : 
                      'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Exchange Info */}
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center mb-2">
                <DollarSign className="w-5 h-5 mr-2 text-blue-500" />
                <h3 className="font-medium">Exchange Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Exchange</p>
                  <p>{safeRender(stockDetails.exchange)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Currency</p>
                  <p>{safeRender(stockDetails.currency)}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'fundamentals':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center mb-4">
                <BarChart2 className="w-5 h-5 mr-2 text-blue-500" />
                <h3 className="font-medium">Financial Fundamentals</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Dividend Information */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-600 border-b pb-1">Dividend Details</h4>
                  <div>
                    <p className="text-sm text-gray-500">Dividend Yield</p>
                    <p className="font-medium text-green-600">
                      {stockDetails.dividendYield}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Forward Dividend</p>
                    <p className="font-medium">
                      {stockDetails.forwardDividend}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ex-Dividend Date</p>
                    <p className="font-medium">
                      {stockDetails.exDividendDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payout Ratio</p>
                    <p className="font-medium">
                      {stockDetails.payoutRatio}
                    </p>
                  </div>
                </div>

                {/* Earnings & Valuation */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-600 border-b pb-1">Earnings & Valuation</h4>
                  <div>
                    <p className="text-sm text-gray-500">EPS (Trailing 12M)</p>
                    <p className="font-medium">
                      {stockDetails.epsTrailingTwelveMonths 
                        ? formatCurrency(stockDetails.epsTrailingTwelveMonths, stockDetails.currency)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Forward EPS</p>
                    <p className="font-medium">
                      {stockDetails.epsForward
                        ? formatCurrency(stockDetails.epsForward, stockDetails.currency)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price/Earnings Ratio</p>
                    <p className="font-medium">
                      {stockDetails.peRatio?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price/Book Ratio</p>
                    <p className="font-medium">
                      {stockDetails.priceToBook?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Market & Shares */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-600 border-b pb-1">Market Information</h4>
                  <div>
                    <p className="text-sm text-gray-500">Market Cap</p>
                    <p className="font-medium">
                      {formatLargeNumber(stockDetails.marketCap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Shares Outstanding</p>
                    <p className="font-medium">
                      {stockDetails.sharesOutstanding ? 
                        Number(stockDetails.sharesOutstanding).toLocaleString() : 
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Book Value per Share</p>
                    <p className="font-medium">
                      {stockDetails.bookValue
                        ? formatCurrency(stockDetails.bookValue, stockDetails.currency)
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-600 border-b pb-1">Performance</h4>
                  <div>
                    <p className="text-sm text-gray-500">50-Day Moving Average</p>
                    <p className="font-medium">
                      {formatCurrency(stockDetails.fiftyDayAverage, stockDetails.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">200-Day Moving Average</p>
                    <p className="font-medium">
                      {formatCurrency(stockDetails.twoHundredDayAverage, stockDetails.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">52-Week Range</p>
                    <p className="font-medium">
                      {stockDetails.fiftyTwoWeekLow && stockDetails.fiftyTwoWeekHigh
                        ? `${formatCurrency(stockDetails.fiftyTwoWeekLow, stockDetails.currency)} - ${formatCurrency(stockDetails.fiftyTwoWeekHigh, stockDetails.currency)}`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'company':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center mb-2">
                <Info className="w-5 h-5 mr-2 text-blue-500" />
                <h3 className="font-medium">Company Information</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Sector</p>
                  <p>{safeRender(stockDetails.sector)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Industry</p>
                  <p>{safeRender(stockDetails.industry)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CEO</p>
                  <p>{safeRender(stockDetails.ceo)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Employees</p>
                  <p>{typeof stockDetails.employees === 'number' ? 
                    stockDetails.employees.toLocaleString() : 
                    safeRender(stockDetails.employees)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Country</p>
                  <p>{safeRender(stockDetails.country)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Founded</p>
                  <p>{safeRender(stockDetails.founded)}</p>
                </div>
              </div>

              {stockDetails.description && stockDetails.description !== 'No description available.' && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-sm">{safeRender(stockDetails.description)}</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Search and Trade Section */}
        <Card>
          <CardHeader>
            <CardTitle>Trade Stocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Stock Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Stock
                </label>
                <form onSubmit={handleSearchSubmit}>
                  <div className="flex space-x-2">
                    <div className="relative flex-grow">
                      <input 
                        ref={searchRef}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Enter company name or symbol (e.g., NatWest, BARC)" 
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
                          {searchResults.map((result, index) => {
                            // Check if name is the same as symbol (or is missing)
                            const nameIsSymbol = !result.name || 
                                              result.name === result.symbol || 
                                              result.name === result.symbol.replace('.L', '');
                            
                            // Use company name if available, otherwise use a placeholder
                            const displayName = !nameIsSymbol 
                              ? result.name
                              : result.symbol === 'TSCO.L' 
                                ? 'Tesco PLC' 
                                : (result.symbol.replace('.L', '') + ' Stock');
                            
                            return (
                              <div 
                                key={index}
                                className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                onClick={() => fetchStockDetails(result.symbol)}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-medium text-base">{displayName}</div>
                                    <div className="text-sm text-gray-600">{result.symbol}</div>
                                  </div>
                                  <div className="text-xs text-gray-500 text-right">
                                    {result.sector && result.sector !== 'N/A' && 
                                      <div className="mb-1">{result.sector}</div>
                                    }
                                    <div>{result.exchange || 'LSE'}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button 
                      type="submit"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-