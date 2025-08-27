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
        <div className="grid grid-cols-3 items-center h-16">
          {/* Left side - QueryBot */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-3 justify-start"
          >
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 dark:from-amber-400 dark:to-amber-600 bg-clip-text text-transparent">
                QueryBot
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">Data Analytics</p>
            </div>
          </motion.div>

          {/* Center - Intelligent Data Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex justify-center"
          >
            <motion.h1 
              className="text-2xl md:text-4xl font-bold tracking-tight text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <span className="text-gray-900 dark:text-white">Intelligent </span>
              <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 bg-clip-text text-transparent">
                Data
              </span>
              <span className="text-gray-900 dark:text-white"> Analytics</span>
            </motion.h1>
          </motion.div>

          {/* Right side - Controls */}
          <div className="flex items-center space-x-3 justify-end">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSettingsClick}
              className="relative group p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200"
            >
              <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
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
                  <Sun className="w-6 h-6 text-amber-500" />
                ) : (
                  <Moon className="w-6 h-6 text-gray-600" />
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
                className="w-9 h-9 object-contain"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}