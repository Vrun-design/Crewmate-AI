import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = "Select an option", className = "" }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex items-center justify-between w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-ring transition-colors text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate mr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto p-1">
              {options.map((option) => (
                <div 
                  key={option.value}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${value === option.value ? 'bg-blue-500/10 text-blue-500' : 'text-foreground hover:bg-secondary'}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check size={14} className="shrink-0 ml-2" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
