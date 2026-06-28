import { type ComponentPropsWithoutRef } from 'react';
import { motion } from 'framer-motion';
import { fadeVariants } from './variants';

type MotionDivProps = ComponentPropsWithoutRef<typeof motion.div>;

export interface PageContainerProps extends Omit<MotionDivProps, 'animate' | 'children' | 'style'> {
  animate?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function PageContainer({
  animate = true,
  children,
  className = '',
  ...props
}: PageContainerProps) {
  if (animate) {
    return (
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={fadeVariants}
        className={`min-h-dvh ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  const {
    initial: _initial,
    variants: _variants,
    exit: _exit,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    whileFocus: _whileFocus,
    whileDrag: _whileDrag,
    whileInView: _whileInView,
    onHoverStart: _onHoverStart,
    onHoverEnd: _onHoverEnd,
    onTapStart: _onTapStart,
    onTap: _onTap,
    onTapCancel: _onTapCancel,
    onDragStart: _onDragStart,
    onDrag: _onDrag,
    onDragEnd: _onDragEnd,
    layout: _layout,
    layoutId: _layoutId,
    ...divProps
  } = props as Record<string, unknown>;

  return (
    <div className={`min-h-dvh ${className}`} {...divProps}>
      {children}
    </div>
  );
}
