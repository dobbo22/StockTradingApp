import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../Components/ui/Card.js";
import { Alert, AlertDescription } from "../Components/ui/Alert.js";
import { Button } from "../Components/ui/Button.js";
import { Search, AlertCircle, BarChart3, DollarSign, TrendingUp } from 'lucide-react';
const API_URL = 'http://localhost:5001/api';

export const ResearchView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStockData = async () => {
      if (searchTerm.length < 1) {
        setStocks([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/stockprofile?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Failed to fetch stocks');
        
        const data = await response.json();
        setStocks(data);
      } catch (err) {
        setError('Failed to fetch stock data');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchStockData, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Stock Research</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stock Search Section */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Search Companies</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter company name or symbol..."
                  className="w-full p-2 pl-8 border rounded-md"
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              
              {loading && (
                <div className="mt-2 text-sm text-gray-500">Loading...</div>
              )}

              {/* Search Results */}
              {stocks.length > 0 && !selectedStock && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-96 overflow-auto">
                  {stocks.map((stock) => (
                    <div
                      key={stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-baseline space-x-2">
                            <span className="font-bold">{stock.companyName}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{stock.symbol}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 mt-1">
                            <div>Industry: {stock.industry || 'N/A'}</div>
                            <div>Sector: {stock.sector || 'N/A'}</div>
                            <div>Country: {stock.country}</div>
                            <div>Exchange: {stock.exchange}</div>
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
                        <h3 className="font-bold text-lg">{selectedStock.companyName}</h3>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{selectedStock.symbol}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{selectedStock.sector || 'N/A'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStock(null)}
                      className="mt-2"
                    >
                      Back to Search
                    </Button>
                  </div>

                  {/* Company Profile */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Company Description</h4>
                      <p className="text-sm text-gray-600">{selectedStock.description}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <h5 className="text-sm font-medium mb-1">CEO</h5>
                        <p className="text-sm text-gray-600">{selectedStock.ceo || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <h5 className="text-sm font-medium mb-1">Employees</h5>
                        <p className="text-sm text-gray-600">
                          {selectedStock.fullTimeEmployees?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <h5 className="text-sm font-medium mb-1">Founded</h5>
                        <p className="text-sm text-gray-600">{selectedStock.ipoDate || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Contact Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">
                            {selectedStock.address}<br />
                            {selectedStock.city}, {selectedStock.state} {selectedStock.zip}<br />
                            {selectedStock.country}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            Phone: {selectedStock.phone || 'N/A'}<br />
                            Website: <a href={selectedStock.website} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{selectedStock.website}</a>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
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