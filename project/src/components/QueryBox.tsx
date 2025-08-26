import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Upload, ChevronDown, Lightbulb, RefreshCw } from 'lucide-react';

interface QueryBoxProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  isFileUploaded: boolean;
  apiKey?: string; // For passing user's API key
}

interface SampleQuestionsData {
  questions: string[];
  data_type: string;
  columns_analyzed: string[];
}

export const QueryBox: React.FC<QueryBoxProps> = ({ 
  onSubmit, 
  isLoading, 
  isFileUploaded, 
  apiKey 
}) => {
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);
  const [dataContext, setDataContext] = useState<string>('');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch sample questions when file is uploaded
  const fetchSampleQuestions = useCallback(async () => {
    if (!isFileUploaded) return;
    
    setIsLoadingQuestions(true);
    setQuestionsError('');
    
    try {
      const url = new URL('https://querybot-production.up.railway.app/sample-questions');
      if (apiKey) {
        url.searchParams.append('api_key', apiKey);
      }
      
      const response = await fetch(url.toString());
      const data: SampleQuestionsData = await response.json();
      
      if (response.ok) {
        setSampleQuestions(data.questions);
        setDataContext(data.data_type);
        console.log(`Loaded ${data.questions.length} contextual questions for ${data.data_type} data`);
      } else {
        throw new Error('Failed to fetch sample questions');
      }
    } catch (error) {
      console.error('Error fetching sample questions:', error);
      setQuestionsError('Failed to generate sample questions');
      // Fallback to basic questions
      setSampleQuestions([
        "Show me a sample of the data",
        "How many records are there in total?",
        "What are the column names?",
        "Show me the data summary",
        "Display the first 10 rows",
        "What types of data do we have?"
      ]);
      setDataContext('general');
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [isFileUploaded, apiKey]);

  // Auto-fetch questions when file is uploaded
  useEffect(() => {
    if (isFileUploaded && sampleQuestions.length === 0) {
      fetchSampleQuestions();
    }
  }, [isFileUploaded, fetchSampleQuestions, sampleQuestions.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query.trim());
    }
  };

  const handleQuickQuestion = (question: string) => {
    setQuery(question);
    setIsDropdownOpen(false);
    if (isFileUploaded && !isLoading) {
      onSubmit(question);
    }
  };

  const refreshQuestions = () => {
    if (!isLoadingQuestions) {
      setSampleQuestions([]);
      fetchSampleQuestions();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getDataTypeDisplay = (context: string) => {
    const contextLabels: { [key: string]: string } = {
      'employee': 'Employee Data',
      'sales': 'Sales Data',
      'supply_chain': 'Supply Chain Data',
      'finance': 'Financial Data',
      'inventory': 'Inventory Data',
      'customer': 'Customer Data',
      'project': 'Project Data',
      'marketing': 'Marketing Data',
      'general': 'General Data'
    };
    return contextLabels[context] || 'Data';
  };

  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        

        

        {/* Main Query Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="relative"
        >
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (query.trim() && !isLoading && isFileUploaded) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder={
                isFileUploaded 
                  ? `Ask anything about your ${getDataTypeDisplay(dataContext).toLowerCase()}... (e.g., try the sample questions below).` 
                  : "Upload a CSV file first to start querying your data..."
              }
              className={`w-full px-6 py-4 pr-16 text-lg border-2 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                isFileUploaded
                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              rows={3}
              disabled={!isFileUploaded || isLoading}
            />
            <motion.button
              type="submit"
              disabled={!query.trim() || isLoading || !isFileUploaded}
              className="absolute bottom-4 right-4 p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              whileHover={{ scale: !isLoading && isFileUploaded ? 1.05 : 1 }}
              whileTap={{ scale: !isLoading && isFileUploaded ? 0.95 : 1 }}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Send size={24} />
              )}
            </motion.button>
          </div>
          
          {/* Character count and status */}
          <div className="flex justify-between items-center mt-3 px-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {query.length}/500 characters
            </div>
            {isFileUploaded && (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Data Ready
              </div>
            )}
          </div>
        </motion.form>

        {/* Sample Questions Dropdown */}
        {isFileUploaded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 relative"
            ref={dropdownRef}
          >
            <motion.button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
            >
              <div className="flex items-center">
                <Lightbulb className="mr-3 text-blue-600 dark:text-blue-400" size={20} />
                <div className="text-left">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    Sample Questions
                  </span>
                  {dataContext && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Generated for your {getDataTypeDisplay(dataContext).toLowerCase()}
                    </p>
                  )}
                </div>
                {isLoadingQuestions && (
                  <Loader2 className="ml-2 animate-spin text-blue-500" size={16} />
                )}
              </div>
              <div className="flex items-center">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshQuestions();
                  }}
                  className="mr-3 p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={isLoadingQuestions}
                >
                  <RefreshCw size={16} className={isLoadingQuestions ? 'animate-spin' : ''} />
                </motion.button>
                <motion.div
                  animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="text-gray-400 dark:text-gray-500" size={20} />
                </motion.div>
              </div>
            </motion.button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden"
                >
                  <div className="py-2">
                    {questionsError && (
                      <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                        {questionsError}
                      </div>
                    )}
                    
                    {isLoadingQuestions ? (
                      <div className="px-4 py-8 text-center">
                        <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={20} />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Generating questions for your data...
                        </p>
                      </div>
                    ) : sampleQuestions.length > 0 ? (
                      sampleQuestions.map((question, index) => (
                        <motion.button
                          key={`${question}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleQuickQuestion(question)}
                          disabled={isLoading}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100 dark:border-gray-700 last:border-b-0 group"
                        >
                          <div className="flex items-start">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                              {question}
                            </span>
                          </div>
                        </motion.button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                        <p className="text-sm">No sample questions available</p>
                        <button
                          onClick={refreshQuestions}
                          className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          Try generating again
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader2 className="animate-spin mr-3 text-blue-600 dark:text-blue-400" size={20} />
              <span className="text-blue-800 dark:text-blue-300">
                Analyzing your query with AI...
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};