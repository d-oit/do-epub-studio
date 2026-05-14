export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const slideUpVariants = {
  initial: { opacity: 0, y: 'var(--motion-slide-offset)' },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: 'calc(-1 * var(--motion-slide-offset))', transition: { duration: 0.2 } },
};

export const slideDownVariants = {
  initial: { opacity: 0, y: 'calc(-1 * var(--motion-slide-offset))' },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: 'var(--motion-slide-offset)', transition: { duration: 0.2 } },
};

export const scaleVariants = {
  initial: { opacity: 0, scale: 'var(--motion-scale-enter)' },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, scale: 'var(--motion-scale-enter)', transition: { duration: 0.15 } },
};

export const staggerContainerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants = {
  initial: { opacity: 0, y: 'var(--motion-item-offset)' },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
