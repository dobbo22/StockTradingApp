import React from 'react';
import { TrendingUp, DollarSign, BarChart2, RefreshCw } from 'lucide-react';

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <div className="flex space-x-2 opacity-50">
              <TrendingUp className="w-16 h-16 text-green-500" />
              <BarChart2 className="w-16 h-16 text-blue-500" />
              <DollarSign className="w-16 h-16 text-purple-500" />
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading Stock Trading Platform</h1>
        <p className="text-gray-600 mb-6">Please wait while we fetch the latest market data...</p>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
          <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-3/4"></div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-500">
          <div className="flex flex-col items-center">
            <DollarSign className="w-6 h-6 text-green-500 mb-1" />
            <span>Fetching Account</span>
          </div>
          <div className="flex flex-col items-center">
            <BarChart2 className="w-6 h-6 text-blue-500 mb-1" />
            <span>Loading Data</span>
          </div>
          <div className="flex flex-col items-center">
            <TrendingUp className="w-6 h-6 text-purple-500 mb-1" />
            <span>Updating Markets</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-sm text-gray-500">
        © {new Date().getFullYear()} Stock Trading Simulator
      </div>
    </div>
  );
};

export default LoadingScreen;