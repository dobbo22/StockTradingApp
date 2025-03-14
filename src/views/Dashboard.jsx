import React, { useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../Components/ui/Card";
import MarketOverview from './MarketOverview';

const formatCurrency = (value, currency = 'GBP') => {
  if (value == null) return '£0.00';
  try {
    return Number(value).toLocaleString('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.error('Currency Formatting Error:', {
      error,
      value,
      type: typeof value
    });
    return '£0.00';
  }
};

const getCompanyName = (transaction, stockLookup) => {
  const symbol = transaction.stock_symbol || transaction.symbol || 'Unknown';
  
  if (transaction.stockName && typeof transaction.stockName === 'string') {
    return { symbol, name: transaction.stockName };
  }
  
  if (stockLookup[symbol]?.name) {
    return { symbol, name: stockLookup[symbol].name };
  }
  
  const ukStocks = {
    'BA.L': 'BAE Systems plc',
    'GSK.L': 'GlaxoSmithKline plc',
    'LLOY.L': 'Lloyds Banking Group plc',
    'VOD.L': 'Vodafone Group plc',
    'BP.L': 'BP plc'
  };
  
  if (ukStocks[symbol]) {
    return { symbol, name: ukStocks[symbol] };
  }
  
  return { symbol, name: symbol };
};

const Dashboard = ({ 
  cash = 0, 
  portfolio = [], 
  stockData = [], 
  transactions = [] 
}) => {
  // Extensive debugging for portfolio updates
  useEffect(() => {
    console.group('Dashboard Portfolio Debug');
    console.log('Cash Received:', cash);
    console.log('Portfolio Received:', JSON.stringify(portfolio, null, 2));
    console.log('Portfolio Length:', portfolio.length);
    
    if (portfolio.length > 0) {
      portfolio.forEach((holding, index) => {
        console.log(`Holding ${index}:`, {
          symbol: holding.symbol,
          marketValue: holding.marketValue,
          shares: holding.shares,
          currentPrice: holding.currentPrice
        });
      });
    }
    
    console.groupEnd();
  }, [cash, portfolio, stockData, transactions]);

  // Create a stock lookup map
  const stockLookup = useMemo(() => {
    return (stockData || []).reduce((acc, stock) => {
      if (stock?.symbol) {
        acc[stock.symbol] = {
          name: stock.name || 
                stock.companyName || 
                stock.profile?.company?.name || 
                stock.symbol,
          price: Number(stock.price) || 0
        };
      }
      return acc;
    }, {});
  }, [stockData]);

  // Calculate portfolio value using the same approach as PortfolioView
  const portfolioValue = useMemo(() => {
    console.group('Dashboard Portfolio Value Calculation');
    
    // If no portfolio, return 0
    if (!Array.isArray(portfolio) || portfolio.length === 0) {
      console.log('No portfolio data available');
      console.groupEnd();
      return 0;
    }

    // Calculate total value using marketValue exactly like PortfolioView
    const total = portfolio.reduce((sum, holding) => {
      // Calculate market value directly if it's not already provided
      let marketValue;
      
      if (holding.marketValue) {
        // Use provided market value
        marketValue = holding.marketValue;
      } else {
        // Calculate market value
        let currentPrice = holding.currentPrice || 0;
        
        // Apply currency conversion if needed (for GBp)
        if (holding.currency === 'GBp') {
          currentPrice = currentPrice / 100;
        }
        
        // Calculate market value based on shares and price
        const shares = parseFloat(holding.shares) || 0;
        marketValue = shares * currentPrice;
      }
      
      console.log(`${holding.symbol}: Shares=${holding.shares}, Price=${holding.currentPrice}, Market Value=${marketValue}`);
      
      return sum + marketValue;
    }, 0);

    console.log('Total Portfolio Value:', total);
    console.groupEnd();
    
    return total;
  }, [portfolio]);

  // Calculate Net Worth
  const netWorth = useMemo(() => {
    const portfolioTotal = portfolioValue || 0;
    const cashTotal = cash || 0;
    const total = portfolioTotal + cashTotal;
    
    console.log('Net Worth Calculation:', {
      portfolioValue: portfolioTotal,
      cashValue: cashTotal,
      netWorth: total
    });
    
    return total;
  }, [portfolioValue, cash]);

  // Get portfolio holdings count directly from the portfolio array
  const holdingsCount = Array.isArray(portfolio) ? portfolio.length : 0;

  // Process transactions for display
  const recentTransactions = useMemo(() => {
    try {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return [];
      }

      return transactions
        .slice(0, 5)  // Limit to 5 most recent transactions
        .map(transaction => {
          // Get company info with all our fallback strategies
          const { symbol, name } = getCompanyName(transaction, stockLookup);
          
          return {
            symbol: symbol,
            stockName: name,
            type: (transaction.type || 'Unknown').toUpperCase(),
            price: Number(transaction.price) || 0,
            quantity: Number(transaction.quantity) || 0,
            transaction_date: transaction.transaction_date || new Date().toISOString()
          };
        })
        .filter(t => t.symbol !== 'Unknown');
    } catch (error) {
      console.error('Transaction Processing Error:', error);
      return [];
    }
  }, [transactions, stockLookup]);

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Available Cash</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(cash)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Portfolio Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(portfolioValue)}
                </p>
                <p className="text-sm text-gray-500">
                  {holdingsCount} holdings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Net Worth</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(netWorth)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction, index) => (
                  <div key={index} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">
                        {transaction.stockName !== transaction.symbol ? 
                          transaction.stockName : 
                          transaction.symbol}
                        
                        {transaction.stockName && transaction.stockName !== transaction.symbol && (
                          <span className="text-gray-500 ml-1">({transaction.symbol})</span>
                        )}
                      </p>
                      <p className={`text-sm ${
                        transaction.type === 'BUY'
                          ? 'text-blue-600'
                          : 'text-red-600'
                      }`}>
                        {transaction.type} - {new Date(transaction.transaction_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(transaction.price)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.quantity.toLocaleString()} shares
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">No recent transactions</p>
              )}
            </div>
          </CardContent>
        </Card>

        <MarketOverview stockData={stockData || []} />
      </div>
    </div>
  );
};

export default Dashboard;