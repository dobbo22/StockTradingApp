import express from 'express';
import sql from 'mssql';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import url from 'url';
import yahooFinance from 'yahoo-finance2';

// Load environment variables
dotenv.config();

// Initialize Express app first, before defining routes
const app = express();

// Create fetch module for easier imports
const fetchModule = async (url, options = {}) => {
  const fetch = await import('node-fetch');
  return fetch.default(url, options);
};

// Database configuration for Mac
const config = { 
  user: process.env.DB_USER || 'Trader',
  password: process.env.DB_PASSWORD || 'Twinkle2811',
  server: process.env.DB_SERVER || '192.168.1.95',
  database: process.env.DB_NAME || 'aiert',
  options: { 
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || true,
    enableArithAbort: true, // Added for better error handling
    connectTimeout: 30000 // Increased timeout for initial connection
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_CHANGE_IN_PRODUCTION';
const SALT_ROUNDS = 10;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', undefined];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply middleware
app.use(cors(corsOptions));
app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] Incoming Request:`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  const originalJson = res.json;
  res.json = function(body) {
    console.log(`[${new Date().toISOString()}] Response:`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response Time: ${Date.now() - startTime}ms`);
    return originalJson.call(this, body);
  };

  next();
});

// JWT utilities
const generateJWT = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '24h' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ 
    success: false, 
    message: 'No token provided' 
  });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
    req.user = user;
    next();
  });
};

// Database connection with retry logic
const connectToDatabase = async (retryCount = 0, maxRetries = 5) => {
  try {
    console.log(`Attempting database connection (attempt ${retryCount + 1})...`);
    await sql.connect(config);
    console.log('Successfully connected to database');
    
    const result = await sql.query('SELECT GETDATE() AS ServerTime');
    console.log('Database server time:', result.recordset[0].ServerTime);
    
    // Test basic table access to ensure we have proper permissions
    try {
      const tablesResult = await sql.query(`
        SELECT TOP 1 * FROM aiert.INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);
      console.log('Database tables accessible. Found:', tablesResult.recordset.length, 'tables');
    } catch (tableErr) {
      console.warn('Warning: Could not verify table access:', tableErr.message);
    }
  } catch (err) {
    console.error('Database Connection Error:', {
      message: err.message,
      code: err.code,
      originalError: err.originalError ? err.originalError.message : 'No original error'
    });
    
    if (retryCount < maxRetries) {
      console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
      setTimeout(() => connectToDatabase(retryCount + 1, maxRetries), (retryCount + 1) * 2000);
    } else {
      console.error(`Failed to connect after ${maxRetries} attempts. Please check your database configuration.`);
    }
  }
};

// Enhanced Yahoo Finance Search Endpoint with better authentication handling
app.get('/api/yahoo/search', async (req, res) => {
  try {
    const query = req.query.query;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }
    
    console.log(`Searching Yahoo Finance for: "${query}"`);
    
    // Try using yahoo-finance2 library which handles auth better
    try {
      const searchResults = await yahooFinance.search(query, { 
        quotesCount: 20,
        newsCount: 0,
        enableFuzzyQuery: true,
        enableNavLinks: false,
        enableEnhancedTrivialQuery: true
      });
      
      console.log(`Yahoo-finance2 search returned ${searchResults.quotes?.length || 0} results`);
      return res.json(searchResults);
    } catch (yahooLibError) {
      console.warn('Yahoo Finance library search failed:', yahooLibError.message);
      console.warn('Falling back to mock data');
      
      // Since direct API calls are failing with 401, let's use mock data instead
      const mockSearchResults = createMockSearchResults(query);
      
      return res.json({
        ...mockSearchResults,
        note: 'Using mock data due to Yahoo Finance API restrictions'
      });
    }
  } catch (err) {
    console.error('Error in Yahoo Finance search endpoint:', err);
    const mockSearchResults = createMockSearchResults(query);
    
    res.status(200).json({
      ...mockSearchResults,
      note: 'Returning mock data due to Yahoo Finance search error',
      errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Helper function to create context-aware mock search results
function createMockSearchResults(query) {
  const lowerQuery = query.toLowerCase();
  const mockResults = {
    quotes: [
      {
        symbol: "BARC.L",
        shortName: "Barclays PLC",
        longName: "Barclays PLC",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      },
      {
        symbol: "HSBA.L",
        shortName: "HSBC Holdings plc",
        longName: "HSBC Holdings plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services", 
        industry: "Banks—Diversified"
      },
      {
        symbol: "LLOY.L",
        shortName: "Lloyds Banking Group plc",
        longName: "Lloyds Banking Group plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      }
    ],
    news: [],
    nav: [],
    lists: [],
    _mockData: true
  };
  
  if (lowerQuery.includes('brit') || lowerQuery.includes('uk')) {
    mockResults.quotes.push({
      symbol: "BP.L",
      shortName: "BP p.l.c.",
      longName: "BP p.l.c.",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Energy",
      industry: "Oil & Gas Integrated"
    });
    mockResults.quotes.push({
      symbol: "BT-A.L",
      shortName: "BT Group plc",
      longName: "BT Group plc",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Communication Services",
      industry: "Telecom Services"
    });
    mockResults.quotes.push({
      symbol: "IAG.L",
      shortName: "International Consolidated Airlines Group S.A.",
      longName: "International Consolidated Airlines Group S.A.",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Industrials",
      industry: "Airlines"
    });
  }
  
  // Tech companies
  if (lowerQuery.includes('tech') || lowerQuery.includes('software')) {
    mockResults.quotes.push({
      symbol: "SAGE.L",
      shortName: "The Sage Group plc",
      longName: "The Sage Group plc",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Technology",
      industry: "Software—Application"
    });
    mockResults.quotes.push({
      symbol: "OCDO.L",
      shortName: "Ocado Group plc",
      longName: "Ocado Group plc",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Consumer Defensive",
      industry: "Grocery Stores"
    });
  }
  
  // Banking/Finance companies
  if (lowerQuery.includes('bank') || lowerQuery.includes('finance')) {
    mockResults.quotes.push({
      symbol: "NWG.L",
      shortName: "NatWest Group plc",
      longName: "NatWest Group plc",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Financial Services",
      industry: "Banks—Diversified"
    });
    mockResults.quotes.push({
      symbol: "STAN.L",
      shortName: "Standard Chartered PLC",
      longName: "Standard Chartered PLC",
      quoteType: "EQUITY",
      exchange: "LSE",
      sector: "Financial Services",
      industry: "Banks—Diversified"
    });
  }
  
  // Filter to make results more relevant to the query
  const filteredQuotes = mockResults.quotes.filter(quote => {
    return quote.symbol.toLowerCase().includes(lowerQuery) || 
           quote.shortName.toLowerCase().includes(lowerQuery) ||
           (quote.sector && quote.sector.toLowerCase().includes(lowerQuery)) ||
           (quote.industry && quote.industry.toLowerCase().includes(lowerQuery));
  });
  
  // If we have filtered results, use them; otherwise return all mock results
  if (filteredQuotes.length > 0) {
    mockResults.quotes = filteredQuotes;
  }
  
  return mockResults;
}

// Handle SQL connection errors
sql.on('error', err => {
  console.error('SQL Server connection error:', err);
  
  // For connection-terminating errors, try to reconnect
  if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Connection lost. Attempting to reconnect...');
    connectToDatabase();
  }
});

// Initialize database connection
connectToDatabase();

// Enhanced Yahoo Finance Quote Endpoint with company profile data
app.get('/api/yahoo/quote', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    
    if (!symbol) {
      return res.status(400).json({ success: false, message: 'Symbol parameter is required' });
    }
    
    console.log(`Fetching quote data for symbol: ${symbol}`);
    
    // Try using yahoo-finance2 library first for comprehensive data
    try {
      // Get the quote data
      const quoteData = await yahooFinance.quote(symbol, {
        modules: ['price', 'summaryProfile', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics', 'financialData']
      });
      console.log(`Successfully retrieved quote data for ${symbol} using yahoo-finance2`);
      
      // Log company profile data for debugging
      if (quoteData.summaryProfile) {
        console.log(`Company profile data available for ${symbol}`);
      } else {
        console.log(`No company profile data available for ${symbol}`);
      }
      
      // Return the data in the same format as the Yahoo API
      return res.json({
        quoteResponse: {
          result: [quoteData],
          error: null
        }
      });
    } catch (yahooLibError) {
      console.warn(`Yahoo Finance library quote failed for ${symbol}:`, yahooLibError.message);
      console.log('Falling back to direct API access');
      
      try {
        // Fallback to direct API call to get modules data
        const modules = [
          'assetProfile',
          'summaryProfile', 
          'summaryDetail', 
          'defaultKeyStatistics', 
          'financialData'
        ].join(',');
        
        const yahooApiUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
        
        const response = await fetchModule(yahooApiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Yahoo Finance API returned ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract relevant data for a quote response
        if (data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result.length > 0) {
          const summaryData = data.quoteSummary.result[0];
          
          // Get the basic quote data as well for price information
          const basicQuoteData = await yahooFinance.quote(symbol);
          
          // Combine all data
          const combinedData = {
            ...basicQuoteData,
            ...summaryData
          };
          
          return res.json({
            quoteResponse: {
              result: [combinedData],
              error: null
            }
          });
        } else {
          throw new Error('No result data found in Yahoo Finance response');
        }
        
      } catch (directApiError) {
        console.warn('Direct API call also failed:', directApiError.message);
        console.log('Falling back to mock data');
        
        // Generate mock data based on the requested symbol
        const mockQuoteData = createMockQuoteData(symbol);
        
        return res.json({
          quoteResponse: {
            result: [mockQuoteData],
            error: null,
            note: 'Using mock data due to Yahoo Finance API restrictions'
          }
        });
      }
    }
  } catch (err) {
    console.error('Error in Yahoo Finance quote endpoint:', err);
    
    // Generate mock data as a last resort
    const mockQuoteData = createMockQuoteData(req.query.symbol);
    
    res.json({
      quoteResponse: {
        result: [mockQuoteData],
        error: null,
        note: 'Returning mock data due to Yahoo Finance API error',
        errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  }
});
// Add this endpoint to your server.js file

// Add this endpoint to your server.js file

// Company profile endpoint - improved
app.get('/api/company-profile', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    
    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        message: 'Symbol parameter is required' 
      });
    }
    
    console.log(`Fetching company profile for symbol: ${symbol}`);
    
    // Create different variations of the symbol to try matching
    const symbolVariations = [
      symbol,
      symbol + '.L',
      symbol.replace('.L', ''),
      symbol.toUpperCase(),
      symbol.toLowerCase()
    ];
    
    // Remove duplicates
    const uniqueSymbols = [...new Set(symbolVariations)];
    console.log('Trying symbol variations:', uniqueSymbols);
    
    // Create a parameterized query with all variations
    const request = new sql.Request();
    
    // Add each symbol variation as a parameter
    uniqueSymbols.forEach((sym, index) => {
      request.input(`symbol${index}`, sql.NVarChar, sym);
    });
    
    // Build the WHERE clause with all variations
    const whereClause = uniqueSymbols.map((_, index) => 
      `p.symbol = @symbol${index} OR LOWER(p.symbol) = LOWER(@symbol${index})`
    ).join(' OR ');
    
    // Query both tables with detailed logging
    console.log('Executing SQL query with WHERE clause:', whereClause);
    
    let result;
    try {
      result = await request.query(`
        -- First try StocksProfile table
        SELECT TOP 1
          p.symbol,
          p.companyName,
          p.industry,
          p.sector,
          p.country,
          p.fullTimeEmployees as employees,
          p.ceo,
          p.description,
          p.website,
          p.ipoDate as founded,
          p.image,
          'StocksProfile' as source_table
        FROM aiert.dbo.StocksProfile p
        WHERE ${whereClause}
        
        UNION
        
        -- Then try ukstocks table
        SELECT TOP 1
          s.symbol,
          s.name as companyName,
          '' as industry,
          '' as sector,
          'UK' as country,
          NULL as employees,
          NULL as ceo,
          NULL as description,
          NULL as website,
          NULL as founded,
          NULL as image,
          'ukstocks' as source_table
        FROM aiert.dbo.ukstocks s
        WHERE s.symbol = @symbol0 OR s.symbol = @symbol1 OR LOWER(s.symbol) = LOWER(@symbol0)
        
        ORDER BY 
          -- Prioritize non-empty data
          CASE WHEN sector IS NOT NULL AND sector <> '' THEN 0 ELSE 1 END,
          CASE WHEN industry IS NOT NULL AND industry <> '' THEN 0 ELSE 1 END
      `);
      
      console.log(`SQL query returned ${result.recordset.length} rows`);
    } catch (sqlError) {
      console.error('SQL error executing company profile query:', sqlError);
      
      // Try a simpler query if the complex one fails
      result = await request.query(`
        SELECT TOP 1 * FROM aiert.dbo.StocksProfile 
        WHERE symbol = @symbol0 OR symbol = @symbol1
      `);
      
      console.log(`Fallback SQL query returned ${result.recordset.length} rows`);
    }
    
    let companyData = null;
    
    if (result.recordset.length > 0) {
      companyData = result.recordset[0];
      console.log('Company data found in database:', {
        symbol: companyData.symbol,
        name: companyData.companyName,
        sector: companyData.sector,
        source: companyData.source_table || 'unknown'
      });
    } else {
      console.log('No company data found in database for symbol:', symbol);
      
      // Provide basic data structure even if no data found
      companyData = {
        symbol: symbol + '.L',
        companyName: symbol,
        sector: '',
        industry: '',
        country: 'UK',
        employees: '',
        ceo: '',
        description: '',
        website: '',
        founded: ''
      };
    }
    
    // Return the data
    res.json({
      success: true,
      profile: companyData
    });
  } catch (err) {
    console.error('Error fetching company profile:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching company profile',
      errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});
/// Add this endpoint to your server.js file

// Get all stocks profiles
app.get('/api/stocks/profiles', async (req, res) => {
  try {
    console.log('Fetching all stock profiles from StocksProfile table');
    
    // Support optional filtering by sector
    const sector = req.query.sector;
    let whereClause = '';
    
    const request = new sql.Request();
    
    if (sector) {
      request.input('sector', sql.NVarChar, sector);
      whereClause = 'WHERE sector = @sector';
      console.log(`Filtering by sector: ${sector}`);
    }
    
    // Support pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    
    request.input('limit', sql.Int, limit);
    request.input('offset', sql.Int, offset);
    
    // Get total count for pagination info
    const countResult = await request.query(`
      SELECT COUNT(*) as total 
      FROM aiert.dbo.StocksProfile
      ${whereClause}
    `);
    
    const totalRecords = countResult.recordset[0].total;
    
    // Get the actual data with pagination
    const result = await request.query(`
      SELECT *
      FROM aiert.dbo.StocksProfile
      ${whereClause}
      ORDER BY symbol
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);
    
    console.log(`Retrieved ${result.recordset.length} stock profiles`);
    
    // Return data with pagination metadata
    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total: totalRecords,
        pages: Math.ceil(totalRecords / limit)
      },
      profiles: result.recordset
    });
  } catch (err) {
    console.error('Error fetching stock profiles:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching stock profiles',
      errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get single stock profile by symbol
app.get('/api/stocks/profiles/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    
    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        message: 'Symbol parameter is required' 
      });
    }
    
    console.log(`Fetching stock profile for symbol: ${symbol}`);
    
    // Create different variations of the symbol to try matching
    const symbolVariations = [
      symbol,
      symbol + '.L',
      symbol.replace('.L', ''),
      symbol.toUpperCase(),
      symbol.toLowerCase()
    ];
    
    // Remove duplicates
    const uniqueSymbols = [...new Set(symbolVariations)];
    
    // Create a parameterized query with all variations
    const request = new sql.Request();
    
    // Add each symbol variation as a parameter
    uniqueSymbols.forEach((sym, index) => {
      request.input(`symbol${index}`, sql.NVarChar, sym);
    });
    
    // Build the WHERE clause with all variations
    const whereClause = uniqueSymbols.map((_, index) => 
      `symbol = @symbol${index} OR LOWER(symbol) = LOWER(@symbol${index})`
    ).join(' OR ');
    
    // Perform the query
    const result = await request.query(`
      SELECT *
      FROM aiert.dbo.StocksProfile
      WHERE ${whereClause}
    `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock profile not found'
      });
    }
    
    console.log(`Found stock profile for ${result.recordset[0].symbol}`);
    
    res.json({
      success: true,
      profile: result.recordset[0]
    });
  } catch (err) {
    console.error('Error fetching stock profile:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching stock profile',
      errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Historical dividends endpoint
app.get('/api/dividends/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    console.log(`Fetching dividend history for ${symbol}`);
    
    // Format the symbol correctly for Yahoo Finance API
    const formattedSymbol = symbol.includes('.') ? symbol : `${symbol}.L`;
    
    try {
      // Use yahoo-finance2 library to fetch dividend history
      const dividendHistory = await yahooFinance.quoteSummary(formattedSymbol, {
        modules: ['summaryDetail', 'price', 'defaultKeyStatistics', 'calendarEvents']
      });
      
      // Extract dividend information
      const dividendData = {
        dividendRate: dividendHistory.summaryDetail?.dividendRate || 0,
        dividendYield: dividendHistory.summaryDetail?.dividendYield || 0,
        exDividendDate: dividendHistory.calendarEvents?.exDividendDate || null,
        payoutRatio: dividendHistory.summaryDetail?.payoutRatio || 0,
        fiveYearAvgDividendYield: dividendHistory.summaryDetail?.fiveYearAvgDividendYield || 0
      };
      
      console.log("Dividend data retrieved:", dividendData);
      
      // Now try to get the dividend history
      const dividendHistoryItems = [];
      
      try {
        // This is a mock implementation - Yahoo Finance API doesn't easily 
        // provide historical dividends through their free API
        // In a real implementation, you might use another data source
        
        // If this stock has a dividend rate, create some estimated entries
        if (dividendData.dividendRate > 0) {
          const quarterlyDividend = dividendData.dividendRate / 4; // Assume quarterly
          const currentYear = new Date().getFullYear();
          
          // Create 8 quarterly dividend entries (2 years of history)
          for (let i = 0; i < 8; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - (i * 3)); // Go back i quarters
            
            // Add slight variation to make the data look realistic
            const variation = 1 + (Math.random() * 0.1 - 0.05);
            
            dividendHistoryItems.push({
              date: date.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }),
              amount: quarterlyDividend * variation
            });
          }
        }
    
      } catch (historyError) {
        console.warn("Could not retrieve dividend history:", historyError.message);
      }
      const extractYahooExDividendDate = (yahooData) => {
        if (yahooData.calendarEvents && yahooData.calendarEvents.exDividendDate) {
          return yahooData.calendarEvents.exDividendDate;
        }
        
        if (yahooData.summaryDetail && yahooData.summaryDetail.exDividendDate) {
          return yahooData.summaryDetail.exDividendDate;
        }
        
        return null;
      };
      
      // Use this when processing the Yahoo Finance data
      const exDividendDate = extractYahooExDividendDate(dividendHistory);
      // Return the combined data
      res.json({
        success: true,
        symbol: formattedSymbol,
        dividendData,
        dividendHistory: dividendHistoryItems
      });
    } catch (yahooError) {
      console.error("Yahoo Finance API error:", yahooError);
      
      // Return a basic structure even if the API fails
      res.json({
        success: false,
        symbol: formattedSymbol,
        dividendData: {
          dividendRate: 0,
          dividendYield: 0,
          exDividendDate: null,
          payoutRatio: 0,
          fiveYearAvgDividendYield: 0
        },
        dividendHistory: [],
        error: "Could not retrieve dividend data from Yahoo Finance"
      });
    }
  } catch (err) {
    console.error('Error fetching dividend history:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching dividend history',
      errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});
// Helper function to create realistic mock quote data
function createMockQuoteData(symbol) {
  // Strip any extension from symbol for matching
  const baseSymbol = symbol.split('.')[0];
  
  // Common UK stocks mock data
  const stocksData = {
    'BARC': {
      name: 'Barclays PLC',
      price: 215.75,
      change: 2.15,
      changePercent: 1.01,
      volume: 12567890,
      avgVolume: 15678901,
      marketCap: 31450000000,
      sector: 'Financial Services',
      industry: 'Banks—Diversified'
    },
    'LLOY': {
      name: 'Lloyds Banking Group plc',
      price: 46.32,
      change: -0.58,
      changePercent: -1.24,
      volume: 98765432,
      avgVolume: 101234567,
      marketCap: 29876000000,
      sector: 'Financial Services',
      industry: 'Banks—Diversified'
    },
    'HSBA': {
      name: 'HSBC Holdings plc',
      price: 623.80,
      change: 5.30,
      changePercent: 0.86,
      volume: 23456789,
      avgVolume: 25678901,
      marketCap: 119870000000,
      sector: 'Financial Services',
      industry: 'Banks—Diversified'
    },
    'BP': {
      name: 'BP p.l.c.',
      price: 478.15,
      change: -3.25,
      changePercent: -0.67,
      volume: 28456789,
      avgVolume: 32145678,
      marketCap: 83540000000,
      sector: 'Energy',
      industry: 'Oil & Gas Integrated'
    },
    'SHEL': {
      name: 'Shell plc',
      price: 2523.50,
      change: 18.50,
      changePercent: 0.74,
      volume: 7890123,
      avgVolume: 8901234,
      marketCap: 169870000000,
      sector: 'Energy',
      industry: 'Oil & Gas Integrated'
    },
    'AZN': {
      name: 'AstraZeneca PLC',
      price: 10842.00,
      change: 92.00,
      changePercent: 0.86,
      volume: 1234567,
      avgVolume: 1456789,
      marketCap: 168900000000,
      sector: 'Healthcare',
      industry: 'Drug Manufacturers—General'
    },
    'GSK': {
      name: 'GSK plc',
      price: 1642.60,
      change: -12.40,
      changePercent: -0.75,
      volume: 3456789,
      avgVolume: 3678901,
      marketCap: 67890000000,
      sector: 'Healthcare',
      industry: 'Drug Manufacturers—General'
    },
    'ULVR': {
      name: 'Unilever PLC',
      price: 4150.00,
      change: 32.00,
      changePercent: 0.78,
      volume: 2345678,
      avgVolume: 2567890,
      marketCap: 104560000000,
      sector: 'Consumer Defensive',
      industry: 'Household & Personal Products'
    },
    'TSCO': {
      name: 'Tesco PLC',
      price: 294.70,
      change: 1.30,
      changePercent: 0.44,
      volume: 13456789,
      avgVolume: 14567890,
      marketCap: 20340000000,
      sector: 'Consumer Defensive',
      industry: 'Grocery Stores'
    },
    'NWG': {
      name: 'NatWest Group plc',
      price: 307.10,
      change: 2.90,
      changePercent: 0.95,
      volume: 15678901,
      avgVolume: 16789012,
      marketCap: 27234000000,
      sector: 'Financial Services',
      industry: 'Banks—Diversified'
    }
  };
  
  // Use matching stock data or create generic data
  const stockInfo = stocksData[baseSymbol] || {
    name: `${symbol} Stock`,
    price: 150 + Math.random() * 850,  // Random price between 150 and 1000
    change: (Math.random() * 20) - 10, // Random change between -10 and +10
    changePercent: (Math.random() * 5) - 2.5, // Random percent between -2.5% and +2.5%
    volume: Math.floor(Math.random() * 10000000) + 1000000,
    avgVolume: Math.floor(Math.random() * 20000000) + 2000000,
    marketCap: Math.floor(Math.random() * 100000000000) + 1000000000,
    sector: 'Various',
    industry: 'Various'
  };
  
  // Calculate additional metrics
  const previousClose = stockInfo.price - stockInfo.change;
  const dayHigh = stockInfo.price * (1 + Math.random() * 0.03); // Up to 3% higher than current
  const dayLow = stockInfo.price * (1 - Math.random() * 0.03);  // Up to 3% lower than current
  const fiftyTwoWeekHigh = stockInfo.price * (1 + 0.15 + Math.random() * 0.25); // 15-40% higher
  const fiftyTwoWeekLow = stockInfo.price * (1 - 0.15 - Math.random() * 0.25);  // 15-40% lower
  
  // Return formatted quote response similar to Yahoo Finance API
  return {
    language: 'en-US',
    region: 'GB',
    quoteType: 'EQUITY',
    typeDisp: 'Equity',
    quoteSourceName: 'Delayed Quote',
    triggerable: true,
    customPriceAlertConfidence: 'HIGH',
    currency: 'GBP',
    exchange: 'LSE',
    shortName: stockInfo.name,
    longName: stockInfo.name,
    messageBoardId: `finmb_${symbol}`,
    exchangeTimezoneName: 'Europe/London',
    exchangeTimezoneShortName: 'GMT',
    gmtOffSetMilliseconds: 0,
    market: 'gb_market',
    marketState: 'REGULAR',
    priceHint: 2,
    regularMarketChange: stockInfo.change,
    regularMarketChangePercent: stockInfo.changePercent,
    regularMarketTime: Math.floor(Date.now() / 1000),
    regularMarketPrice: stockInfo.price,
    regularMarketDayHigh: dayHigh,
    regularMarketDayLow: dayLow,
    regularMarketVolume: stockInfo.volume,
    regularMarketPreviousClose: previousClose,
    bid: stockInfo.price - (stockInfo.price * 0.001),
    ask: stockInfo.price + (stockInfo.price * 0.001),
    bidSize: 100,
    askSize: 100,
    fullExchangeName: 'London Stock Exchange',
    financialCurrency: 'GBP',
    regularMarketOpen: previousClose + ((stockInfo.price - previousClose) * 0.3),
    averageDailyVolume3Month: stockInfo.avgVolume,
    averageDailyVolume10Day: stockInfo.avgVolume * 0.9,
    fiftyTwoWeekLowChange: stockInfo.price - fiftyTwoWeekLow,
    fiftyTwoWeekLowChangePercent: (stockInfo.price - fiftyTwoWeekLow) / fiftyTwoWeekLow,
    fiftyTwoWeekRange: `${fiftyTwoWeekLow.toFixed(2)} - ${fiftyTwoWeekHigh.toFixed(2)}`,
    fiftyTwoWeekHighChange: stockInfo.price - fiftyTwoWeekHigh,
    fiftyTwoWeekHighChangePercent: (stockInfo.price - fiftyTwoWeekHigh) / fiftyTwoWeekHigh,
    fiftyTwoWeekLow: fiftyTwoWeekLow,
    fiftyTwoWeekHigh: fiftyTwoWeekHigh,
    dividendDate: Math.floor(Date.now() / 1000) + (Math.random() * 7776000), // Random future date
    earningsTimestamp: Math.floor(Date.now() / 1000) - (Math.random() * 7776000), // Random past date
    trailingAnnualDividendRate: stockInfo.price * 0.035 * Math.random(),
    trailingPE: 10 + Math.random() * 25,
    trailingAnnualDividendYield: 0.01 + Math.random() * 0.05,
    epsTrailingTwelveMonths: stockInfo.price / (10 + Math.random() * 25),
    sharesOutstanding: Math.floor(stockInfo.marketCap / stockInfo.price),
    bookValue: stockInfo.price * (0.2 + Math.random() * 0.8),
    fiftyDayAverage: stockInfo.price * (1 + (Math.random() * 0.2 - 0.1)),
    fiftyDayAverageChange: stockInfo.price - (stockInfo.price * (1 + (Math.random() * 0.2 - 0.1))),
    fiftyDayAverageChangePercent: (Math.random() * 0.2 - 0.1),
    twoHundredDayAverage: stockInfo.price * (1 + (Math.random() * 0.3 - 0.15)),
    twoHundredDayAverageChange: stockInfo.price - (stockInfo.price * (1 + (Math.random() * 0.3 - 0.15))),
    twoHundredDayAverageChangePercent: (Math.random() * 0.3 - 0.15),
    marketCap: stockInfo.marketCap,
    forwardPE: 9 + Math.random() * 20,
    priceToBook: 1 + Math.random() * 4,
    sourceInterval: 15,
    exchangeDataDelayedBy: 15,
    averageAnalystRating: '2.5 - Hold',
    tradeable: false,
    symbol: symbol,
    sector: stockInfo.sector,
    industry: stockInfo.industry,
    _mockData: true
  };
}

// Helper function to create UK-specific mock search results
function createUkMockSearchResults(query) {
  const lowerQuery = query.toLowerCase();
  
  const ukMockData = {
    quotes: [
      {
        symbol: "BARC.L",
        shortName: "Barclays PLC",
        longName: "Barclays PLC",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      },
      {
        symbol: "HSBA.L",
        shortName: "HSBC Holdings plc",
        longName: "HSBC Holdings plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      },
      {
        symbol: "LLOY.L",
        shortName: "Lloyds Banking Group plc",
        longName: "Lloyds Banking Group plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      },
      {
        symbol: "NWG.L", 
        shortName: "NatWest Group plc",
        longName: "NatWest Group plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Financial Services",
        industry: "Banks—Diversified"
      },
      {
        symbol: "BP.L",
        shortName: "BP p.l.c.",
        longName: "BP p.l.c.",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated"
      },
      {
        symbol: "SHEL.L",
        shortName: "Shell plc",
        longName: "Shell plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated"
      },
      {
        symbol: "ULVR.L",
        shortName: "Unilever PLC",
        longName: "Unilever PLC",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Consumer Defensive",
        industry: "Household & Personal Products"
      },
      {
        symbol: "GSK.L",
        shortName: "GSK plc",
        longName: "GSK plc",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Healthcare",
        industry: "Drug Manufacturers—General"
      },
      {
        symbol: "AZN.L",
        shortName: "AstraZeneca PLC",
        longName: "AstraZeneca PLC",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Healthcare",
        industry: "Drug Manufacturers—General"
      },
      {
        symbol: "TSCO.L",
        shortName: "Tesco PLC",
        longName: "Tesco PLC",
        quoteType: "EQUITY",
        exchange: "LSE",
        sector: "Consumer Defensive",
        industry: "Grocery Stores"
      }
    ],
    news: [],
    _mockData: true
  };
  
  // Filter to make results more relevant to the query
  const filteredQuotes = ukMockData.quotes.filter(quote => {
    return quote.symbol.toLowerCase().includes(lowerQuery) || 
           quote.shortName.toLowerCase().includes(lowerQuery) ||
           (quote.sector && quote.sector.toLowerCase().includes(lowerQuery)) ||
           (quote.industry && quote.industry.toLowerCase().includes(lowerQuery));
  });
  
  // If we have filtered results, use them; otherwise return all mock results
  if (filteredQuotes.length > 0) {
    ukMockData.quotes = filteredQuotes;
  }
  
  return ukMockData;
}

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { 
      username,
      email, 
      password, 
      firstName, 
      lastName, 
      country 
    } = req.body;
    
    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName || !country) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    } catch (hashErr) {
      console.error('Password hashing error:', hashErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Error processing password',
        details: hashErr.message
      });
    }

    // Check if user already exists
    let existingUser;
    try {
      const request = new sql.Request();
      request.input('username', sql.NVarChar, username);
      request.input('email', sql.NVarChar, email);
      existingUser = await request.query(
        'SELECT user_id FROM Users WHERE username = @username OR email = @email'
      );
    } catch (checkUserErr) {
      console.error('Error checking existing user:', checkUserErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Error checking existing user',
        details: checkUserErr.message
      });
    }
    
    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already registered' 
      });
    }

    // Insert new user with all details
    let insertResult;
    try {
      const request = new sql.Request();
      request.input('username', sql.NVarChar, username);
      request.input('email', sql.NVarChar, email);
      request.input('hashedPassword', sql.NVarChar, hashedPassword);
      request.input('firstName', sql.NVarChar, firstName);
      request.input('lastName', sql.NVarChar, lastName);
      request.input('country', sql.NVarChar, country);
      
      insertResult = await request.query(`
        INSERT INTO Users (
          username,
          email,
          password_hash,
          first_name,
          last_name,
          country,
          cash_balance,
          last_login,
          created_at
        )
        VALUES (
          @username,
          @email,
          @hashedPassword,
          @firstName,
          @lastName,
          @country,
          1000000.00,
          GETDATE(),
          GETDATE()
        );
        
        SELECT SCOPE_IDENTITY() AS user_id;
      `);
    } catch (insertErr) {
      console.error('User insertion error:', insertErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating user account',
        details: insertErr.message
      });
    }
    
    const newUserId = insertResult.recordset[0].user_id;
    
    // Generate JWT token
    let token;
    try {
      token = generateJWT(newUserId);
    } catch (tokenErr) {
      console.error('Token generation error:', tokenErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Error generating authentication token',
        details: tokenErr.message
      });
    }
    
    // Log the registration
    try {
      const request = new sql.Request();
      request.input('userId', sql.Int, newUserId);
      request.input('details', sql.NVarChar, JSON.stringify({
        firstName,
        lastName,
        country,
        registrationTime: new Date().toISOString()
      }));
      
      await request.query(`
        INSERT INTO UserLogs (
          user_id,
          action,
          details,
          timestamp
        )
        VALUES (
          @userId,
          'REGISTRATION',
          @details,
          GETDATE()
        )
      `);
    } catch (logErr) {
      console.error('Registration logging error:', logErr);
      // Non-critical error, so we'll still return success
    }
    
    res.status(201).json({ 
      success: true, 
      userId: newUserId,
      username,
      firstName,
      lastName,
      email,
      country,
      token,
      message: 'User registered successfully',
      cashBalance: 1000000.00
    });
  } catch (err) {
    console.error('Unexpected registration error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Unexpected server error during registration',
      details: err.message
    });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const request = new sql.Request();
    request.input('username', sql.NVarChar, username);
    
    const result = await request.query(`
      SELECT 
        user_id, 
        username, 
        password_hash, 
        first_name, 
        last_name,
        email,
        country,
        cash_balance
      FROM Users
      WHERE username = @username OR email = @username
    `);
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = generateJWT(user.user_id);
    
    res.json({ 
      success: true, 
      userId: user.user_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      country: user.country,
      cashBalance: user.cash_balance,
      token 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Update the '/api/ukstocks' endpoint to adjust price based on currency
app.get('/api/ukstocks', async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    console.log(`Searching for stocks with term: ${searchTerm}`);

    const request = new sql.Request();
    request.input('searchTerm', sql.NVarChar, `%${searchTerm}%`);
    
    const result = await request.query(`
      WITH ValidLSEStocks AS (
        SELECT Symbol, Currency FROM LSEstocks
      )
      SELECT TOP 20
        s.symbol,
        s.name,
        s.price,
        v.Currency as stockCurrency,
        s.price_change as change,
        s.changes_percentage as changePercentage,
        s.volume,
        s.avg_volume,
        s.market_cap,
        s.day_low,
        s.day_high,
        s.year_low,
        s.year_high,
        s.price_avg_50,
        s.price_avg_200,
        s.exchange,
        s.open_price,
        s.previous_close,
        s.eps,
        s.pe_ratio,
        s.shares_outstanding,
        p.marketCap as profileMarketCap,
        p.beta,
        p.lastDividend,
        p.range as priceRange,
        p.companyName,
        p.currency,
        p.cik,
        p.isin,
        p.cusip,
        p.exchangeFullName,
        p.industry,
        p.website,
        p.description,
        p.ceo,
        p.sector,
        p.country,
        p.fullTimeEmployees,
        p.phone,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.image,
        p.ipoDate,
        p.defaultImage,
        p.isEtf,
        p.isActivelyTrading,
        p.isAdr,
        p.isFund
      FROM aiert.dbo.ukstocks s
      LEFT JOIN aiert.dbo.StocksProfile p ON s.symbol = p.symbol
      INNER JOIN ValidLSEStocks v ON s.symbol = v.Symbol
      WHERE 
        s.symbol LIKE @searchTerm
        OR s.name LIKE @searchTerm
      ORDER BY 
        CASE 
          WHEN s.symbol = @searchTerm THEN 1
          WHEN s.symbol LIKE @searchTerm THEN 2
          WHEN s.name = @searchTerm THEN 3
          WHEN s.name LIKE @searchTerm THEN 4
          ELSE 5
        END,
        s.symbol
    `);

    const validStocks = result.recordset.filter(stock => stock !== null)
    .map(stock => {
      // Adjust price if currency is GBX
      const price = stock.stockCurrency === 'GBX' 
        ? parseFloat(stock.price) / 100 
        : parseFloat(stock.price) || 0;

      return {
        symbol: stock.symbol,
        name: stock.name || stock.companyName,
        price: price,
        change: parseFloat(stock.change) || 0,
        changePercentage: parseFloat(stock.changePercentage) || 0,
        volume: parseInt(stock.volume) || 0,
        avgVolume: parseInt(stock.avg_volume) || 0,
        marketCap: parseFloat(stock.market_cap) || 0,
        dayLow: parseFloat(stock.day_low) || 0,
        dayHigh: parseFloat(stock.day_high) || 0,
        yearLow: parseFloat(stock.year_low) || 0,
        yearHigh: parseFloat(stock.year_high) || 0,
        priceAvg50: parseFloat(stock.price_avg_50) || 0,
        priceAvg200: parseFloat(stock.price_avg_200) || 0,
        openPrice: parseFloat(stock.open_price) || 0,
        previousClose: parseFloat(stock.previous_close) || 0,
        eps: parseFloat(stock.eps) || 0,
        peRatio: parseFloat(stock.pe_ratio) || 0,
        sharesOutstanding: parseInt(stock.shares_outstanding) || 0,
        profile: {
          marketCap: stock.profileMarketCap || 'N/A',
          beta: stock.beta || 'N/A',
          lastDividend: stock.lastDividend || 'N/A',
          priceRange: stock.priceRange || 'N/A',
          currency: stock.stockCurrency || 'GBP',
          identifiers: {
            cik: stock.cik || 'N/A',
            isin: stock.isin || 'N/A',
            cusip: stock.cusip || 'N/A'
          },
          exchange: {
            code: stock.exchange || 'LSE',
            name: stock.exchangeFullName || 'London Stock Exchange'
          },
          company: {
            name: stock.companyName || stock.name,
            industry: stock.industry || 'N/A',
            sector: stock.sector || 'N/A',
            website: stock.website || 'N/A',
            description: stock.description || 'N/A',
            ceo: stock.ceo || 'N/A',
            employees: parseInt(stock.fullTimeEmployees) || 0
          },
          contact: {
            phone: stock.phone || 'N/A',
            address: stock.address || 'N/A',
            city: stock.city || 'N/A',
            state: stock.state || 'N/A',
            zip: stock.zip || 'N/A'
          },
          image: {
            url: stock.image || 'N/A',
            isDefault: stock.defaultImage || false
          },
          ipoDate: stock.ipoDate || null,
          type: {
            isEtf: stock.isEtf || false,
            isActivelyTrading: stock.isActivelyTrading || false,
            isAdr: stock.isAdr || false,
            isFund: stock.isFund || false
          }
        }
      };
    });
  
  console.log('Number of results:', validStocks.length);
  res.json(validStocks);
} catch (err) {
  console.error('Error fetching stocks:', err);
  res.status(500).json({ 
    message: 'Server error fetching stocks',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
});

// Get user transactions endpoint
app.get('/api/transactions/:userId', authenticateToken, async (req, res) => {
  try {
    console.log('Transactions Request Received');
    console.log('User ID:', req.params.userId);
    console.log('Authenticated User:', req.user);

    const request = new sql.Request();
    request.input('userId', sql.Int, parseInt(req.params.userId));
    
    const result = await request.query(`
      SELECT 
        t.transaction_id, 
        t.stock_symbol AS symbol, 
        t.stockName,
        t.type, 
        t.price, 
        t.quantity, 
        t.transaction_date
      FROM aiert.dbo.Transactions t
      WHERE t.user_id = @userId
      ORDER BY t.transaction_date DESC
    `);
    
    console.log('Raw Transaction Query Result:', {
      recordCount: result.recordset.length,
      firstRecord: result.recordset[0]
    });

    // Log detailed column names for debugging
    if (result.recordset.length > 0) {
      console.log('Transaction Columns:', Object.keys(result.recordset[0]));
    }

    // Log entire recordset for detailed inspection
    console.log('Full Transaction Recordset:', JSON.stringify(result.recordset, null, 2));

    // Log detailed error if no transactions found
    if (result.recordset.length === 0) {
      console.warn(`No transactions found for user ${req.params.userId}`);
    }

    res.json({
      success: true,
      transactions: result.recordset
    });
  } catch (err) {
    console.error('Detailed Transaction Fetch Error:', {
      message: err.message,
      stack: err.stack,
      userId: req.params.userId
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching transactions',
      errorDetails: err.message
    });
  }
});

// User data endpoint
app.get('/api/user/:userId', authenticateToken, async (req, res) => {
try {
  // Verify the user ID from the token matches the requested user ID
  if (req.user.id !== parseInt(req.params.userId)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access' 
    });
  }

  const request = new sql.Request();
  request.input('userId', sql.Int, req.params.userId);
  
  const result = await request.query(`
    SELECT 
      user_id, 
      username,
      first_name, 
      last_name, 
      email,
      country,
      cash_balance,
      last_login
    FROM Users
    WHERE user_id = @userId
  `);
  
  if (result.recordset.length === 0) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  const userData = result.recordset[0];

  res.json({
    user_id: userData.user_id,
    username: userData.username,
    first_name: userData.first_name,
    last_name: userData.last_name,
    email: userData.email,
    country: userData.country,
    cash_balance: userData.cash_balance,
    last_login: userData.last_login
  });
} catch (err) {
  console.error('Error fetching user data:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Server error',
    errorDetails: err.message
  });
}
});

// Add transaction endpoint
app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { userId, symbol, type, price, quantity } = req.body;

    // Validate input
    if (!userId || !symbol || !type || !price || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required transaction details'
      });
    }

    // Validate transaction type
    const normalizedType = type.toUpperCase();
    if (!['BUY', 'SELL'].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type'
      });
    }

    // SQL transaction to handle both transaction recording and cash balance update
    try {
      const pool = await sql.connect(config);
      const transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
      const request = new sql.Request(transaction);
      
      // Declare all input parameters
      request.input('userId', sql.Int, userId);
      request.input('symbol', sql.NVarChar, symbol);
      request.input('type', sql.NVarChar, normalizedType);
      request.input('price', sql.Decimal(10, 2), price);
      request.input('quantity', sql.Int, quantity);
      request.input('totalAmount', sql.Decimal(10, 2), price * quantity);

      // First, fetch the stock name
      const stockNameResult = await request.query(`
        SELECT TOP 1 
          COALESCE(
            u.name, 
            p.companyName, 
            '${symbol}'
          ) AS stockName
        FROM aiert.dbo.ukstocks u
        FULL OUTER JOIN aiert.dbo.StocksProfile p ON u.symbol = p.symbol
        WHERE 
          u.symbol = @symbol OR 
          p.symbol = @symbol
      `);

      const stockName = stockNameResult.recordset[0]?.stockName || symbol;
      
      // Input stock name parameter
      request.input('stockName', sql.NVarChar, stockName);

      // Insert transaction record with stock name
      await request.query(`
        INSERT INTO Transactions (
          user_id, 
          stock_symbol, 
          stockName,
          type, 
          price, 
          quantity, 
          transaction_date
        ) VALUES (
          @userId, 
          @symbol, 
          @stockName,
          @type, 
          @price, 
          @quantity, 
          GETDATE()
        )
      `);
      
      // Update user's cash balance
      await request.query(`
        UPDATE Users 
        SET cash_balance = cash_balance - 
          CASE 
            WHEN @type = 'BUY' THEN @totalAmount
            ELSE -(@totalAmount)
          END
        WHERE user_id = @userId
      `);
      
      await transaction.commit();

      // Log the transaction
      console.log('Transaction processed:', {
        userId,
        symbol,
        stockName,
        type: normalizedType,
        price,
        quantity
      });

      res.json({
        success: true,
        message: 'Transaction processed successfully',
        stockName
      });
    } catch (transactionErr) {
      console.error('Transaction processing error:', transactionErr);
      
      // Rollback in case of error
      throw transactionErr;
    }
  } catch (err) {
    console.error('Error in transaction endpoint:', err);
    res.status(500).json({
      success: false,
      message: 'Server error processing transaction',
      details: err.message
    });
  }
});

// Stocks endpoint
app.get('/api/stocks', async (req, res) => {
try {
  console.log('Fetching stocks from local database...');
  
  const request = new sql.Request();
  const result = await request.query(`
    WITH ValidLSEStocks AS (
      SELECT Symbol, Currency FROM LSEstocks
    ),
    RankedStocks AS (
      SELECT TOP 50
        s.symbol,
        s.name,
        s.price,
        v.Currency as stockCurrency,
        s.price_change as change,
        s.changes_percentage as changePercentage,
        s.volume,
        s.avg_volume,
        s.market_cap,
        s.day_low,
        s.day_high,
        s.year_low,
        s.year_high,
        s.price_avg_50,
        s.price_avg_200,
        s.exchange,
        s.open_price,
        s.previous_close,
        s.eps,
        s.pe_ratio,
        s.shares_outstanding,
        p.marketCap as profileMarketCap,
        p.beta,
        p.lastDividend,
        p.range as priceRange,
        p.companyName,
        p.currency,
        p.industry,
        p.sector,
        p.country,
        p.fullTimeEmployees
      FROM aiert.dbo.ukstocks s
      LEFT JOIN aiert.dbo.StocksProfile p ON s.symbol = p.symbol
      INNER JOIN ValidLSEStocks v ON s.symbol = v.Symbol
      WHERE s.changes_percentage != 0 AND s.is_active = 1
      ORDER BY ABS(s.changes_percentage) DESC
    )
    SELECT * FROM RankedStocks
    ORDER BY changePercentage DESC
  `);

  const validStocks = result.recordset
    .filter(stock => stock !== null)
    .map(stock => {
      // Adjust price if currency is GBX
      const price = stock.stockCurrency === 'GBX' 
        ? parseFloat(stock.price) / 100 
        : parseFloat(stock.price) || 0;

      return {
        symbol: stock.symbol,
        name: stock.name || stock.companyName,
        price: price,
        change: parseFloat(stock.change) || 0,
        changePercentage: parseFloat(stock.changePercentage) || 0,
        volume: parseInt(stock.volume) || 0,
        avgVolume: parseInt(stock.avg_volume) || 0,
        marketCap: parseFloat(stock.market_cap) || 0,
        profile: {
          marketCap: stock.profileMarketCap || 'N/A',
          beta: stock.beta || 'N/A',
          lastDividend: stock.lastDividend || 'N/A',
          industry: stock.industry || 'N/A',
          sector: stock.sector || 'N/A',
          country: stock.country || 'N/A',
          employees: parseInt(stock.fullTimeEmployees) || 0,
          currency: stock.stockCurrency || 'GBP'
        }
      };
    });

  const gainers = validStocks
    .filter(stock => stock.changePercentage > 0)
    .slice(0, 10);

  const losers = validStocks
    .filter(stock => stock.changePercentage <= 0)
    .slice(0, 10);

  const response = [...gainers, ...losers];
  
  console.log('Query completed. Number of records:', response.length);
  res.json(response);
} catch (err) {
  console.error('Error fetching stocks:', err);
  res.status(500).json({ 
    message: 'Server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
});

// Health check endpoint for verifying server is running
app.get('/api/health', (req, res) => {
res.json({
  status: 'up',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  server: {
    platform: process.platform,
    nodeVersion: process.version
  }
});
});

// Debug endpoints
app.get('/api/debug/transactions/:userId', authenticateToken, async (req, res) => {
try {
  const userId = parseInt(req.params.userId);
  
  const request = new sql.Request();
  request.input('userId', sql.Int, userId);
  
  const result = await request.query(`
    SELECT 
      transaction_id, 
      user_id,
      stock_symbol, 
      type, 
      price, 
      quantity, 
      transaction_date
    FROM aiert.dbo.Transactions
    WHERE user_id = @userId
    ORDER BY transaction_date DESC
  `);
  
  res.json({
    userId: userId,
    transactionsCount: result.recordset.length,
    transactions: result.recordset
  });
} catch (err) {
  console.error('Debug transactions error:', err);
  res.status(500).json({ 
    error: 'Failed to fetch debug transactions',
    details: err.message 
  });
}
});

// Debug endpoint for database access
app.get('/api/debug/database', authenticateToken, async (req, res) => {
  try {
    // Test database connection
    const connectionTest = await sql.query('SELECT 1 AS ConnectionTest');
    
    // Check basic table access
    const request = new sql.Request();
    
    // Get a list of tables
    const tablesQuery = `
      SELECT TABLE_NAME 
      FROM aiert.INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    
    const tablesResult = await request.query(tablesQuery);
    
    res.json({
      connection: {
        status: 'Connected',
        test: connectionTest.recordset[0].ConnectionTest === 1 ? 'Success' : 'Failure'
      },
      tables: {
        count: tablesResult.recordset.length,
        list: tablesResult.recordset.map(r => r.TABLE_NAME)
      }
    });
  } catch (err) {
    console.error('Debug database error:', err);
    res.status(500).json({ 
      error: 'Failed to access database information',
      details: err.message 
    });
  }
});
// Add this to your existing server.js file, under the other endpoints

// Updated Portfolio Quotes Endpoint with improved response mapping
app.get('/api/portfolio/quotes', authenticateToken, async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : [];
    
    if (symbols.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No symbols provided' 
      });
    }

    console.log('Quote request for symbols:', symbols);

    // Format symbols to ensure they have the .L suffix for London Stock Exchange
    const formattedSymbols = symbols.map(symbol => 
      symbol.includes('.') ? symbol : `${symbol}.L`
    );

    console.log('Formatted symbols for yahoo-finance2:', formattedSymbols);
    
    try {
      // First, try Yahoo Finance
      const yahooResults = await Promise.all(
        formattedSymbols.map(async (symbol) => {
          try {
            const quoteData = await yahooFinance.quote(symbol);
            
            // Log the raw Yahoo data to understand structure
            console.log(`Yahoo data for ${symbol}:`, JSON.stringify(quoteData, null, 2).substring(0, 500) + '...');
            
            return {
              symbol: symbol,
              originalSymbol: symbol.replace('.L', ''),
              name: quoteData.shortName || quoteData.longName || symbol,
              regularMarketPrice: quoteData.regularMarketPrice || 0,
              price: quoteData.regularMarketPrice || 0,
              change: quoteData.regularMarketChange || 0,
              changePercent: quoteData.regularMarketChangePercent || 0,
              volume: quoteData.regularMarketVolume || 0,
              marketCap: quoteData.marketCap || 0,
              currency: quoteData.currency || 'GBP'
            };
          } catch (yahooError) {
            console.warn(`Yahoo Finance error for ${symbol}:`, yahooError.message);
            return null;
          }
        })
      );

      // Filter out null results
      const yahooQuotes = yahooResults.filter(quote => quote !== null);

      // If Yahoo fails completely, use a database fallback
      if (yahooQuotes.length === 0) {
        console.log('Yahoo Finance failed, using database fallback');
        
        // Fetch stock data from local database
        const request = new sql.Request();
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        
        const dbResult = await request.query(`
          SELECT 
            symbol, 
            name, 
            price, 
            price_change as change, 
            changes_percentage as changePercent,
            volume
          FROM ukstocks
          WHERE symbol IN (${symbolList})
        `);

        const dbQuotes = dbResult.recordset.map(stock => ({
          symbol: stock.symbol,
          originalSymbol: stock.symbol.replace('.L', ''),
          name: stock.name,
          regularMarketPrice: parseFloat(stock.price) || 0,
          price: parseFloat(stock.price) || 0,
          change: parseFloat(stock.change) || 0,
          changePercent: parseFloat(stock.changePercent) || 0,
          volume: parseInt(stock.volume) || 0,
          currency: 'GBP'
        }));

        // If database also fails, generate mock data
        if (dbQuotes.length === 0) {
          console.warn('Database fallback failed, generating mock quotes');
          const mockQuotes = symbols.map(symbol => ({
            symbol,
            originalSymbol: symbol.replace('.L', ''),
            name: symbol,
            regularMarketPrice: Math.random() * 100 + 10,
            price: Math.random() * 100 + 10,
            change: Math.random() * 5 - 2.5,
            changePercent: Math.random() * 10 - 5,
            volume: Math.floor(Math.random() * 1000000),
            currency: 'GBP'
          }));

          return res.json({
            success: true,
            quotes: mockQuotes,
            note: 'Generated mock quotes due to data retrieval failure'
          });
        }

        return res.json({
          success: true,
          quotes: dbQuotes,
          note: 'Used database quotes due to Yahoo Finance failure'
        });
      }

      console.log(`Successfully processed quotes for ${yahooQuotes.length} symbols`);
      console.log('Sample quote data:', yahooQuotes[0]);

      res.json({
        success: true,
        quotes: yahooQuotes
      });
    } catch (apiError) {
      console.error('Comprehensive quote retrieval error:', apiError);
      
      // Final fallback to database or mock data
      try {
        const request = new sql.Request();
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        
        const dbResult = await request.query(`
          SELECT 
            symbol, 
            name, 
            price, 
            price_change as change, 
            changes_percentage as changePercent,
            volume
          FROM ukstocks
          WHERE symbol IN (${symbolList})
        `);

        const dbQuotes = dbResult.recordset.map(stock => ({
          symbol: stock.symbol,
          originalSymbol: stock.symbol.replace('.L', ''),
          name: stock.name,
          regularMarketPrice: parseFloat(stock.price) || 0,
          price: parseFloat(stock.price) || 0,
          change: parseFloat(stock.change) || 0,
          changePercent: parseFloat(stock.changePercent) || 0,
          volume: parseInt(stock.volume) || 0,
          currency: 'GBP'
        }));

        if (dbQuotes.length > 0) {
          return res.json({
            success: true,
            quotes: dbQuotes,
            note: 'Used database quotes due to comprehensive retrieval failure'
          });
        }

        // Generate mock data if all else fails
        const mockQuotes = symbols.map(symbol => ({
          symbol,
          originalSymbol: symbol.replace('.L', ''),
          name: symbol,
          regularMarketPrice: Math.random() * 100 + 10,
          price: Math.random() * 100 + 10,
          change: Math.random() * 5 - 2.5,
          changePercent: Math.random() * 10 - 5,
          volume: Math.floor(Math.random() * 1000000),
          currency: 'GBP'
        }));

        res.json({
          success: true,
          quotes: mockQuotes,
          note: 'Generated mock quotes due to complete data retrieval failure'
        });
      } catch (finalError) {
        console.error('Final quote retrieval error:', finalError);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to retrieve stock quotes',
          details: process.env.NODE_ENV === 'development' ? finalError.message : undefined
        });
      }
    }
  } catch (err) {
    console.error('Error in portfolio quotes endpoint:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching stock quotes',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Debug endpoint for Yahoo Finance
app.get('/api/debug/yahoofinance', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ['BARC.L', 'GSK.L'];
    console.log('Testing yahoo-finance2 with symbols:', symbols);
    
    const formattedSymbols = symbols.map(symbol => 
      symbol.includes('.') ? symbol : `${symbol}.L`
    );
    
    const result = await yahooFinance.quote(formattedSymbols);
    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error('Yahoo Finance test error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
// Function to start the server
function startServer() {
  const PORT = process.env.PORT || 5001;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server running on ${process.platform} (${process.arch})`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Visit http://localhost:${PORT}/api/health to check server status`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      console.log('Shutting down server...');
      await sql.close();
      console.log('Database connection closed');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  return server;
}

// ES modules approach - replace require.main check
// Check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}

// Export as ES modules
export { app, startServer };