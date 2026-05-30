import React from 'react';
import { motion } from 'motion/react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
      {/* Subtle Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern" />
      
      {/* Floating Blobs */}
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[10%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-natural-primary/5 blur-[120px]"
      />
      
      <motion.div
        animate={{
          x: [0, -40, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute bottom-[10%] right-[5%] w-[35vw] h-[35vw] rounded-full bg-natural-muted/5 blur-[100px]"
      />

      <motion.div
        animate={{
          x: [0, -30, 0],
          y: [0, -40, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[40%] right-[20%] w-[20vw] h-[20vw] rounded-full bg-natural-primary/10 blur-[80px]"
      />
    </div>
  );
};
