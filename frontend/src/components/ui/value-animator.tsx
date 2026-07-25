// src/components/ui/value-animator.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ValueAnimatorProps {
  /** numeric value to animate, can be undefined/null */
  value?: number | null;
  /** placeholder when value is undefined or null */
  placeholder?: React.ReactNode;
  /** duration of the count-up animation in seconds */
  duration?: number;
}

export const ValueAnimator: React.FC<ValueAnimatorProps> = ({
  value,
  placeholder = '—',
  duration = 1,
}) => {
  if (value == null) {
    return <>{placeholder}</>;
  }
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration }}
    >
      {Number(value).toLocaleString()}
    </motion.span>
  );
};
