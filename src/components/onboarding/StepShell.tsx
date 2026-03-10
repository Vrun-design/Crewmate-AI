import React from 'react';
import { motion } from 'motion/react';

type StepShellProps = {
  children: React.ReactNode;
  className: string;
};

export function StepShell({ children, className }: StepShellProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
