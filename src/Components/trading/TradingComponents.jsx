import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Alert, AlertDescription } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Search, AlertCircle, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export const MarketOverview = ({ stockData = [] }) => {
  // Split stocks into gainers and losers
  const gainers = stockData
    .filter(stock => stock.changePercentage > 0)
    .sort((a, b) => b.changePercentage - a.changePercentage)
    .slice(0, 10);

  const losers = stockData
    .filter(stock => stock.changePercentage <= 0)
    .sort((a, b) => a.changePercentage - b.changePercentage)
    .slice(0, 10);

  const StockList = ({ stocks, type }) => (
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
      <div className="space-y-3">
        {stocks.map((stock) => (
          <div key={stock.symbol} className="flex justify-between items-start border-b pb-2">
            <div>
              <p className="font-medium">{stock.symbol}</p>
              <p className="text-sm text-gray-500">{stock.name}</p>
              <div className="text-xs text-gray-500">
                {stock.sector}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {parseFloat(stock.price).toLocaleString('en-GB', { 
                  style: 'currency', 
                  currency: stock.currency || 'GBP',
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4
                })}
              </div>
              <div className={`text-sm ${stock.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stock.changePercentage >= 0 ? '+' : ''}{Number(stock.changePercentage).toFixed(2)}%
              </div>
              {stock.volume && (
                <div className="text-xs text-gray-500">
                  Vol: {(Number(stock.volume) / 1000000).toFixed(1)}M
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>UK Market Movers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <StockList stocks={gainers} type="gainers" />
          <StockList stocks={losers} type="losers" />
        </div>
      </CardContent>
    </Card>
  );
};

export const PortfolioView = ({ portfolio = {} }) => {
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Holdings Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(portfolio).length > 0 ? (
              Object.entries(portfolio).map(([symbol, holding]) => (
                <div key={symbol} className="border-b pb-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items baseline space-x-2">
                      <h3 className="text-lg font-bold">{holding.name}</h3>
                      <span className="text-gray-400">•</span>
                      <p className="text-gray-600">{symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium">
                        {holding.currentValue.toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: 'GBP' 
                        })}
                      </p>
                      <p className={`text-sm ${holding.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.profitLoss.toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: 'GBP' 
                        })}
                        {' '}
                        ({holding.profitLossPercentage.toFixed(2)}%)
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Shares</p>
                      <p className="font-medium">{holding.shares.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Average Cost</p>
                      <p className="font-medium">
                        {holding.avgPrice.toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: 'GBP',
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Current Price</p>
                      <p className="font-medium">
                        {holding.currentPrice.toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: 'GBP',
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Cost</p>
                      <p className="font-medium">
                        {holding.totalCost.toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: 'GBP' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No holdings in portfolio</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const TradingView = ({ cash, onTrade }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ukStocks, setUkStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [tradeType, setTradeType] = useState('buy');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPreview, setOrderPreview] = useState(null);

  useEffect(() => {
    const fetchUKStocks = async () => {
      if (searchTerm.length < 1) {
        setUkStocks([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/ukstocks?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Failed to fetch stocks');
        
        const data = await response.json();
        setUkStocks(data);
      } catch (err) {
        setError('Failed to fetch UK stocks');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUKStocks, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedStock && quantity) {
      const shares = parseInt(quantity);
      const totalCost = shares * parseFloat(selectedStock.price);
      setOrderPreview({
        shares,
        pricePerShare: parseFloat(selectedStock.price),
        totalCost,
        canAfford: totalCost <= cash || tradeType === 'sell'
      });
    } else {
      setOrderPreview(null);
    }
  }, [selectedStock, quantity, tradeType, cash]);

  const handleTrade = () => {
    setError('');
    if (!selectedStock) {
      setError('Please select a stock');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    const totalCost = qty * parseFloat(selectedStock.price);
    
    if (tradeType === 'buy' && totalCost > cash) {
      setError('Insufficient funds');
      return;
    }

    onTrade({
      symbol: selectedStock.symbol,
      quantity: qty,
      type: tradeType,
      price: parseFloat(selectedStock.price)
    });

    // Reset form
    setSelectedStock(null);
    setQuantity('');
    setSearchTerm('');
    setOrderPreview(null);
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Trade Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stock Search Section */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Search UK Stocks</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter stock symbol or name..."
                  className="w-full p-2 pl-8 border rounded-md"
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              
              {loading && (
                <div className="mt-2 text-sm text-gray-500">Loading...</div>
              )}

              {/* Search Results */}
              {ukStocks.length > 0 && !selectedStock && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-96 overflow-auto">
                  {ukStocks.map((stock) => (
                    <div
                      key={stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-baseline space-x-2">
                            <span className="font-bold">{stock.name}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{stock.symbol}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 mt-1">
                            <div>Sector: {stock.sector || 'N/A'}</div>
                            <div>Vol: {(stock.volume / 1000000).toFixed(1)}M</div>
                            <div>Market Cap: £{(stock.market_cap / 1000000).toFixed(0)}M</div>
                            <div>Day Range: £{stock.day_low?.toFixed(4)} - £{stock.day_high?.toFixed(4)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {parseFloat(stock.price).toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: stock.currency || 'GBP',
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}
                          </div>
                          <div className={`text-xs ${stock.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stock.changePercentage >= 0 ? '+' : ''}
                            {stock.changePercentage?.toFixed(2)}%
                            {' '}
                            ({stock.price_change >= 0 ? '+' : ''}
                            {parseFloat(stock.price_change).toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: stock.currency || 'GBP',
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })})
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Stock Details */}
            {selectedStock && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-baseline space-x-2">
                        <h3 className="font-bold text-lg">{selectedStock.name}</h3>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{selectedStock.symbol}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{selectedStock.sector || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {parseFloat(selectedStock.price).toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: selectedStock.currency || 'GBP',
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        })}
                      </p>
                      <p className={`text-sm ${selectedStock.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>{selectedStock.changePercentage >= 0 ? '+' : ''}
                        {selectedStock.changePercentage?.toFixed(2)}%
                        {' '}
                        ({selectedStock.price_change >= 0 ? '+' : ''}
                        {parseFloat(selectedStock.price_change).toLocaleString('en-GB', { 
                          style: 'currency', 
                          currency: selectedStock.currency || 'GBP',
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        })})
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedStock(null);
                          setQuantity('');
                          setOrderPreview(null);
                        }}
                        className="mt-2"
                      >
                        Change Stock
                      </Button>
                    </div>
                  </div>

                  {/* Market Data Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-gray-200 pt-4">
                    <div className="p-3 bg-white rounded-md shadow-sm">
                      <div className="flex items-center space-x-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Day Range</span>
                      </div>
                      <p className="font-medium text-sm">
                        {selectedStock.day_low ? (
                          <>
                            {(selectedStock.day_low).toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: 'GBP',
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}
                            {' - '}
                            {(selectedStock.day_high).toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: 'GBP',
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}
                          </>
                        ) : 'N/A'}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-md shadow-sm">
                      <div className="flex items-center space-x-2 mb-1">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Market Cap</span>
                      </div>
                      <p className="font-medium text-sm">
                        {selectedStock.market_cap ? (
                          `£${(selectedStock.market_cap / 1000000).toLocaleString('en-GB', { 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}M`
                        ) : 'N/A'}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-md shadow-sm">
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Volume</span>
                      </div>
                      <p className="font-medium text-sm">
                        {selectedStock.volume ? (
                          `${(selectedStock.volume / 1000000).toLocaleString('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}M`
                        ) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trade Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-2 border rounded-md"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div className="flex space-x-4">
                    <Button
                      onClick={() => setTradeType('buy')}
                      variant={tradeType === 'buy' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      Buy
                    </Button>
                    <Button
                      onClick={() => setTradeType('sell')}
                      variant={tradeType === 'sell' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      Sell
                    </Button>
                  </div>

                  {/* Order Preview */}
                  {orderPreview && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <h4 className="font-medium mb-2">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Action:</span>
                          <span className="font-medium">{tradeType.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shares:</span>
                          <span className="font-medium">{orderPreview.shares.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Price per Share:</span>
                          <span className="font-medium">
                            {orderPreview.pricePerShare.toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: 'GBP',
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-600">Total {tradeType === 'buy' ? 'Cost' : 'Value'}:</span>
                          <span className="font-bold">
                            {orderPreview.totalCost.toLocaleString('en-GB', { 
                              style: 'currency', 
                              currency: 'GBP',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                        {tradeType === 'buy' && (
                          <div className="mt-2 text-sm">
                            <div className="flex justify-between text-gray-600">
                              <span>Available Cash:</span>
                              <span>
                                {cash.toLocaleString('en-GB', { 
                                  style: 'currency', 
                                  currency: 'GBP',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Remaining After Trade:</span>
                              <span className={`font-medium ${orderPreview.canAfford ? 'text-green-600' : 'text-red-600'}`}>
                                {(cash - orderPreview.totalCost).toLocaleString('en-GB', { 
                                  style: 'currency', 
                                  currency: 'GBP',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={handleTrade} 
                    className="w-full"
                    disabled={!orderPreview || (tradeType === 'buy' && !orderPreview.canAfford)}
                  >
                    Place Order
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};