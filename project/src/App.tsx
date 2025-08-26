import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Hero } from './components/Hero';
import { QueryBox } from './components/QueryBox';
import { AnswerDisplay } from './components/AnswerDisplay';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL; // Your FastAPI server URL

interface QueryResult {
  success: boolean;
  data: any[];
  columns: string[];
  question: string;
  sql_query?: string;
  message?: string;
}

interface ApiService {
  uploadFile: (file: File) => Promise<any>;
  processQuery: (query: string) => Promise<QueryResult>;
  checkOllamaStatus: () => Promise<any>;
  getDataOverview: () => Promise<any>;
}

// API Service
const apiService: ApiService = {
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload-csv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return await response.json();
  },

  async processQuery(query: string): Promise<QueryResult> {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        table_name: 'supply_chain_data'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Query failed');
    }

    return await response.json();
  },

  async checkOllamaStatus() {
    const response = await fetch(`${API_BASE_URL}/ollama/status`);
    
    if (!response.ok) {
      throw new Error('Failed to check Ollama status');
    }

    return await response.json();
  },

  async getDataOverview() {
    const response = await fetch(`${API_BASE_URL}/data/overview`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get data overview');
    }

    return await response.json();
  }
};

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [dataOverview, setDataOverview] = useState<any>(null);

  // Handle query processing
  const handleQuery = async (query: string) => {
    if (!isFileUploaded) {
      setResult({
        success: false,
        data: [],
        columns: [],
        question: query,
        message: 'Please upload a CSV file first before querying.'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const queryResult = await apiService.processQuery(query);
      setResult(queryResult);
    } catch (error) {
      console.error('Query error:', error);
      setResult({
        success: false,
        data: [],
        columns: [],
        question: query,
        message: error instanceof Error ? error.message : 'Failed to process query. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setUploadStatus('Uploading file...');
    
    try {
      const uploadResult = await apiService.uploadFile(file);
      setIsFileUploaded(true);
      setUploadStatus(`✅ ${uploadResult.message}`);
      
      // Get data overview after successful upload
      try {
        const overview = await apiService.getDataOverview();
        setDataOverview(overview);
      } catch (overviewError) {
        console.warn('Failed to load data overview:', overviewError);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsFileUploaded(false);
    }
  };

  // Check API connection on component mount
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (!response.ok) {
          console.warn('API server not responding');
        }
      } catch (error) {
        console.warn('API server not accessible:', error);
      }
    };

    checkConnection();
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
        <Navbar onSettingsClick={() => setIsSidebarOpen(true)} />
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          onFileUpload={handleFileUpload}
          uploadStatus={uploadStatus}
          isFileUploaded={isFileUploaded}
          dataOverview={dataOverview}
        />
        
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Hero />
          
          {/* REMOVED: Upload Status Display - Now only shows in sidebar */}

          <QueryBox 
            onSubmit={handleQuery} 
            isLoading={isLoading}
            isFileUploaded={isFileUploaded}
          />
          <AnswerDisplay result={result} />
        </motion.main>

        <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Powered by AI-driven analytics for intelligent data insights
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              API Server: {API_BASE_URL}
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
