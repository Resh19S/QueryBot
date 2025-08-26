import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarProps {
  onSettingsClick: () => void;
}

export function Navbar({ onSettingsClick }: NavbarProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-3"
          >
            {/* Just the name/title on the left */}
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 dark:from-amber-400 dark:to-amber-600 bg-clip-text text-transparent">
                QueryBot
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">Data Analytics</p>
            </div>
          </motion.div>

          <div className="flex items-center space-x-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSettingsClick}
              className="relative group p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="absolute inset-0 rounded-xl ring-2 ring-transparent group-hover:ring-amber-400/30 transition-all duration-200"></div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="relative group p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200"
            >
              <motion.div
                animate={{ rotate: isDark ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-amber-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </motion.div>
              <div className="absolute inset-0 rounded-xl ring-2 ring-transparent group-hover:ring-amber-400/30 transition-all duration-200"></div>
            </motion.button>

            {/* Logo positioned last on the right */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-100 dark:bg-transparent rounded-lg p-1"
            >
              <img 
                src={isDark ? "/PUB.PA_BIG.D.png" : "/PUB.PA_BIG.png"}
                alt="QueryBot Logo" 
                className="w-8 h-8 object-contain"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}