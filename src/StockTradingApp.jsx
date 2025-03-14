import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { Alert, AlertDescription } from "./Components/ui/Alert";
import { AuthContainer } from './Components/auth/AuthContainer';
import Dashboard from './views/Dashboard'; 
import PortfolioView from './views/PortfolioView';
import TradingView from './views/TradingView';
import LoadingScreen from './Components/LoadingScreen';

const API_URL = 'http://localhost:5001/api';

// API request helper with proper error handling
const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  try {
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, { ...options, headers });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        // Clear stored tokens on auth failure
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        
        // Force app refresh to return to login screen
        window.location.reload();
        
        throw new Error('Authentication failed. Please login again.');
      }
      
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Function to check token validity
const validateToken = async () => {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      return false;
    }
    
    // Make a lightweight call to validate the token
    await apiRequest(`${API_URL}/user/${userId}`);
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};

const StockTradingApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [portfolio, setPortfolio] = useState([]);
  const [cash, setCash] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add refs to prevent duplicate API calls
  const isFetchingUserData = useRef(false);
  const isFetchingStockData = useRef(false);
  const isFetchingTransactions = useRef(false);
  const lastFetchTime = useRef(0);
  const dataInitialized = useRef(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('userId');
      
      if (token && storedUserId) {
        setIsLoading(true);
        try {
          const isValid = await validateToken();
          if (isValid) {
            setIsAuthenticated(true);
            setUserId(storedUserId);
          } else {
            // Clear invalid credentials
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Authentication check failed:', error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Separate function to calculate portfolio
  const calculatePortfolio = useCallback(async (transactionsList, currentStockData) => {
    console.group('Detailed Portfolio Calculation');
    console.log('Transactions input:', JSON.stringify(transactionsList, null, 2));
    console.log('Stock data input:', JSON.stringify(currentStockData, null, 2));
  
    if (!transactionsList?.length) {
      console.warn('Cannot calculate portfolio: missing transactions');
      console.groupEnd();
      return [];
    }
  
    try {
      // Step 1: Group transactions by symbol
      const holdingsMap = {};
      
      transactionsList.forEach(t => {
        const symbol = t.symbol || t.stock_symbol;
        if (!symbol) {
          console.warn('Transaction missing symbol:', t);
          return;
        }
        
        const quantity = parseInt(t.quantity, 10);
        const price = parseFloat(t.price);
        
        if (isNaN(quantity) || isNaN(price)) {
          console.warn('Invalid transaction data:', t);
          return;
        }
        
        if (!holdingsMap[symbol]) {
          holdingsMap[symbol] = { 
            shares: 0, 
            totalCost: 0,
            transactions: [] 
          };
        }
        
        if (t.type.toUpperCase() === 'BUY') {
          holdingsMap[symbol].shares += quantity;
          holdingsMap[symbol].totalCost += quantity * price;
          holdingsMap[symbol].transactions.push({
            type: 'BUY',
            quantity,
            price,
            totalCost: quantity * price
          });
        } else if (t.type.toUpperCase() === 'SELL') {
          holdingsMap[symbol].shares -= quantity;
          // Adjust cost basis proportionally
          const shareRatio = quantity / (holdingsMap[symbol].shares + quantity);
          holdingsMap[symbol].totalCost -= holdingsMap[symbol].totalCost * shareRatio;
          holdingsMap[symbol].transactions.push({
            type: 'SELL',
            quantity,
            price,
            totalCost: -(quantity * price)
          });
        }
      });
  
      console.log('Holdings Map after transaction processing:', 
        JSON.stringify(holdingsMap, (key, value) => 
          key === 'transactions' ? value.map(t => `${t.type}: ${t.quantity} @ ${t.price}`) : value, 
        2)
      );
    
      // Step 2: Filter out positions with zero or negative shares
      Object.keys(holdingsMap).forEach(symbol => {
        if (holdingsMap[symbol].shares <= 0) {
          delete holdingsMap[symbol];
        } else {
          // Calculate average price
          holdingsMap[symbol].avgPrice = holdingsMap[symbol].totalCost / holdingsMap[symbol].shares;
        }
      });
  
      // Fetch current quotes for all symbols
      const symbols = Object.keys(holdingsMap);
      console.log('Symbols to fetch quotes for:', symbols);
  
      let yahooFinancePrices = {};
  
      if (symbols.length > 0) {
        try {
          const token = localStorage.getItem('token');
          const quoteResponse = await fetch(`${API_URL}/portfolio/quotes?symbols=${symbols.join(',')}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
  
          const quoteData = await quoteResponse.json();
          
          console.log('Quote Response:', JSON.stringify(quoteData, null, 2));
          
          if (quoteData.success && quoteData.quotes) {
            // Create a map of Yahoo Finance prices with multiple symbol formats
            yahooFinancePrices = quoteData.quotes.reduce((acc, quote) => {
              // Convert from pence to pounds if needed
              const price = quote.currency === 'GBp' 
                ? quote.regularMarketPrice / 100 
                : quote.regularMarketPrice;
              
              // If conversion happened, log it
              if (quote.currency === 'GBp') {
                console.log(`Converting ${quote.symbol} from pence to pounds: ${quote.regularMarketPrice} / 100 = ${price}`);
              }
              
              // Add multiple symbol variations
              acc[quote.symbol] = price;
              acc[quote.symbol + '.L'] = price;
              acc[quote.symbol.replace('.L', '')] = price;
              
              return acc;
            }, {});
            
            console.log('Yahoo Finance Prices:', yahooFinancePrices);
  
            console.log('Yahoo Finance Prices:', yahooFinancePrices);
          }
        } catch (quoteError) {
          console.error('Error fetching quotes:', quoteError);
        }
      }
  
      // Step 3: Convert to array with current market values
      const portfolioArray = Object.entries(holdingsMap).map(([symbol, holding]) => {
        // Prioritize Yahoo Finance price with multiple lookup strategies
        let currentPrice = yahooFinancePrices[symbol] || 
          yahooFinancePrices[symbol.replace('.L', '')] || 
          yahooFinancePrices[symbol + '.L'];
        
        // Fallback to local stock data if no Yahoo Finance price
        if (!currentPrice) {
          const stock = currentStockData.find(s => 
            s.symbol === symbol || 
            s.symbol.replace('.L', '') === symbol.replace('.L', '')
          );
          currentPrice = stock ? parseFloat(stock.price) : 0;
        }
  
        const shares = holding.shares;
        const marketValue = shares * currentPrice;
        const profitLoss = marketValue - holding.totalCost;
        const returnPercent = holding.totalCost > 0 
          ? (profitLoss / holding.totalCost) * 100 
          : 0;
        
        const stock = currentStockData.find(s => 
          s.symbol === symbol || 
          s.symbol.replace('.L', '') === symbol.replace('.L', '')
        );
        
        const result = {
          symbol,
          name: stock?.name || symbol,
          shares,
          avgPrice: holding.avgPrice,
          currentPrice,
          marketValue,
          profitLoss,
          returnPercent
        };
        
        console.log('Calculated portfolio entry:', JSON.stringify(result, null, 2));
        
        return result;
      });
    
      console.log('Final Portfolio Calculation:', 
        JSON.stringify(portfolioArray, null, 2)
      );
      console.groupEnd();
      
      return portfolioArray;
    } catch (error) {
      console.error('Error calculating portfolio:', error);
      console.groupEnd();
      return [];
    }
  }, [API_URL]);
  
  // Load transactions only once
  const fetchTransactions = useCallback(async () => {
    if (!userId || isFetchingTransactions.current) return null;
    
    isFetchingTransactions.current = true;
    try {
      console.log('Fetching transactions...');
      const response = await apiRequest(`${API_URL}/transactions/${userId}`);
      console.log('Transactions fetched:', response.transactions?.length || 0);
      
      // Extract transactions array with validation
      const transactionsList = response.transactions || [];
      setTransactions(transactionsList);
      isFetchingTransactions.current = false;
      return transactionsList;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      isFetchingTransactions.current = false;
      return null;
    }
  }, [userId]);

  const fetchUserData = useCallback(async () => {
    if (!userId || isFetchingUserData.current) return;

    isFetchingUserData.current = true;
    try {
      console.log('Fetching user data...');
      
      // Fetch user data
      const userData = await apiRequest(`${API_URL}/user/${userId}`);
      setCash(userData.cash_balance || 0);
      console.log('User data fetched, cash balance:', userData.cash_balance);
      
      isFetchingUserData.current = false;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setNotification('Failed to fetch user data');
      setIsLoading(false);
      isFetchingUserData.current = false;
    }
  }, [userId]);

  const fetchStockData = useCallback(async () => {
    // Prevent duplicate calls within a short time period
    const now = Date.now();
    if (isFetchingStockData.current || (now - lastFetchTime.current < 10000)) {
      console.log('Skipping duplicate stock data fetch', {
        isFetching: isFetchingStockData.current,
        timeSinceLastFetch: now - lastFetchTime.current
      });
      return null;
    }
    
    isFetchingStockData.current = true;
    lastFetchTime.current = now;
    
    try {
      console.log('Fetching stock data from API...');
      
      // Try both API endpoints with more robust error handling
      let data = null;
      let fetchSuccess = false;

      const apiUrl = API_URL; // Use local variable instead of dependency
      
      try {
        const stocksResponse = await fetch(`${apiUrl}/stocks`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-cache'
        });
        
        if (stocksResponse.ok) {
          data = await stocksResponse.json();
          console.log('Stocks endpoint response:', data.length);
          
          if (Array.isArray(data) && data.length > 0) {
            fetchSuccess = true;
          } else {
            console.warn('Empty data from /stocks endpoint');
          }
        } else {
          console.warn('Failed to fetch from /stocks endpoint:', stocksResponse.status);
        }
      } catch (error) {
        console.error('Error fetching from /stocks endpoint:', error);
      }
      
      // If first attempt fails, try ukstocks endpoint
      if (!fetchSuccess) {
        try {
          console.log('Trying ukstocks endpoint...');
          const ukStocksResponse = await fetch(`${apiUrl}/ukstocks?search=`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            cache: 'no-cache'
          });
          
          if (ukStocksResponse.ok) {
            data = await ukStocksResponse.json();
            console.log('UKStocks endpoint response:', data.length);
            
            if (Array.isArray(data) && data.length > 0) {
              fetchSuccess = true;
            } else {
              console.warn('Empty data from /ukstocks endpoint');
            }
          } else {
            console.warn('Failed to fetch from /ukstocks endpoint:', ukStocksResponse.status);
          }
        } catch (error) {
          console.error('Error fetching from /ukstocks endpoint:', error);
        }
      }
      
      // Use sample data if both API calls fail
      if (!fetchSuccess) {
        console.log('Using sample stock data as fallback');
        
        // Sample data for testing when API is unavailable
        data = [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            price: 150.25,
            change: 2.50,
            changePercentage: 1.75,
            volume: 65000000,
            marketCap: 2500000000000,
            currency: "GBP"
          },
          {
            symbol: "MSFT",
            name: "Microsoft Corporation",
            price: 320.45,
            change: -1.30,
            changePercentage: -0.40,
            volume: 28000000,
            marketCap: 2400000000000,
            currency: "GBP"
          },
          {
            symbol: "GOOGL",
            name: "Alphabet Inc.",
            price: 135.75,
            change: 0.85,
            changePercentage: 0.63,
            volume: 18000000,
            marketCap: 1700000000000,
            currency: "GBP"
          }
        ];
        
        setNotification('Using sample market data. Live market data unavailable.');
        setTimeout(() => setNotification(null), 5000);
      }
      
      // Update state with whatever data we have (API or sample)
      setStockData(data);
      isFetchingStockData.current = false;
      return data;
    } catch (err) {
      console.error('Unhandled error in fetchStockData:', err);
      isFetchingStockData.current = false;
      setIsLoading(false);
      return null;
    }
  }, []);

  // Combined data fetching effect that runs once after authentication
  useEffect(() => {
    if (isAuthenticated && userId && !dataInitialized.current) {
      console.log('Initial data fetch triggered');
      
      const fetchInitialData = async () => {
        try {
          dataInitialized.current = true; // Set flag to prevent repeated initialization
          setIsLoading(true);
          
          // Fetch in series to avoid race conditions
          await fetchUserData();
          const transactionData = await fetchTransactions();
          const stockData = await fetchStockData();
          
          console.log('Transaction Data:', JSON.stringify(transactionData, null, 2));
          console.log('Stock Data:', JSON.stringify(stockData, null, 2));
          
          // Calculate portfolio once we have both transactions and stock data
          if (transactionData && stockData) {
            const calculatedPortfolio = await calculatePortfolio(transactionData, stockData);
            
            console.log('Calculated Portfolio:', JSON.stringify(calculatedPortfolio, null, 2));
            
            // Explicitly log before setting state
            console.log('Setting portfolio state to:', calculatedPortfolio);
            setPortfolio(calculatedPortfolio);
          }
          
          setIsLoading(false);
        } catch (error) {
          console.error('Error during initial data fetch:', error);
          setIsLoading(false);
        }
      };
      
      fetchInitialData();
      
      // Set up polling with a longer interval
      const pollInterval = setInterval(() => {
        console.log('Polling for updated stock data');
        isFetchingStockData.current = false; // Allow refetching on interval
        fetchStockData().then(stockData => {
          if (stockData && transactions.length > 0) {
            calculatePortfolio(transactions, stockData).then(updatedPortfolio => {
              console.log('Updating portfolio on poll:', JSON.stringify(updatedPortfolio, null, 2));
              setPortfolio(updatedPortfolio);
            });
          }
        });
      }, 300000); // Poll every 5 minutes
      
      return () => clearInterval(pollInterval);
    }
  }, [isAuthenticated, userId, fetchUserData, fetchTransactions, fetchStockData, calculatePortfolio, transactions]);

  const handleAuthSuccess = ({ userId }) => {
    setUserId(userId);
    setIsAuthenticated(true);
    setIsLoading(true); // Set loading to true as we'll fetch data after login
    dataInitialized.current = false; // Reset data initialized flag
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    setUserId(null);
    setPortfolio([]);
    setTransactions([]);
    setStockData([]);
    dataInitialized.current = false;
  };

  const handleTrade = async (tradeDetails) => {
    try {
      console.group('Trade Handling Process');
      console.log('Trade Details:', tradeDetails);
      
      setIsLoading(true);
      
      // Post the transaction
      const transactionResponse = await apiRequest(`${API_URL}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          ...tradeDetails
        })
      });
      console.log('Transaction Response:', transactionResponse);
      
      // Fetch updated transactions
      const updatedTransactions = await fetchTransactions();
      console.log('Updated Transactions:', updatedTransactions);
      
      // Fetch updated stock data
      const updatedStockData = await fetchStockData();
      console.log('Updated Stock Data:', updatedStockData);
      
      // Calculate new portfolio
      if (updatedTransactions && updatedStockData) {
        const newPortfolio = await calculatePortfolio(updatedTransactions, updatedStockData);
        
        console.log('New Portfolio Calculation:', newPortfolio);
        
        // Update multiple states at once
        setTransactions(updatedTransactions);
        setStockData(updatedStockData);
        setPortfolio(newPortfolio);
        
        // Log the state updates
        console.log('Current Transactions Count:', updatedTransactions.length);
        console.log('Current Portfolio Length:', newPortfolio.length);
      }
      
      // Update cash balance
      const userData = await apiRequest(`${API_URL}/user/${userId}`);
      console.log('Updated User Data:', userData);
      setCash(userData.cash_balance || 0);
      
      setNotification(`Successfully ${tradeDetails.type} ${tradeDetails.quantity} shares of ${tradeDetails.symbol}`);
      setTimeout(() => setNotification(null), 3000);
      setIsLoading(false);
      
      console.groupEnd();
    } catch (err) {
      console.error('Error processing trade:', err);
      setNotification('Failed to process trade: ' + (err.message || 'Unknown error'));
      setIsLoading(false);
      console.groupEnd();
    }
  };

  if (!isAuthenticated) {
    return <AuthContainer onAuthSuccess={handleAuthSuccess} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Memoize view components to prevent unnecessary re-renders
  const renderContent = () => {
    console.log('Rendering content with portfolio:', JSON.stringify(portfolio, null, 2));
    
    switch(currentView) {
      case 'dashboard':
        return (
          <Dashboard
            cash={cash}
            portfolio={portfolio}
            stockData={stockData}
            transactions={transactions}
          />
        );
      case 'portfolio':
        return (
          <PortfolioView
            transactions={transactions}
            stockData={stockData}
            portfolio={portfolio}
          />
        );
      case 'trade':
        return (
          <TradingView
            cash={cash}
            onTrade={handleTrade}
          />
        );
      default:
        return null;
    }
  };

  const content = renderContent();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-xl font-bold">Stock Trading Competition</div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setCurrentView('dashboard')} 
              className={`hover:text-gray-300 ${currentView === 'dashboard' ? 'text-white font-bold' : 'text-gray-300'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentView('portfolio')} 
              className={`hover:text-gray-300 ${currentView === 'portfolio' ? 'text-white font-bold' : 'text-gray-300'}`}
            >
              Portfolio
            </button>
            <button 
              onClick={() => setCurrentView('trade')} 
              className={`hover:text-gray-300 ${currentView === 'trade' ? 'text-white font-bold' : 'text-gray-300'}`}
            >
              Trade
            </button>
            <button onClick={handleLogout} className="hover:text-gray-300 flex items-center">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {notification && (
        <Alert className="m-4">
          <AlertDescription>{notification}</AlertDescription>
        </Alert>
      )}
      
      <main>
        {content}
      </main>
    </div>
  );
};

export default StockTradingApp;