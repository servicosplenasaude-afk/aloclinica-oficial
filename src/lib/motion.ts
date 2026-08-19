import type { Transition, Variants } from "framer-motion";

/** Shared, restrained motion primitives for application UI. */
export const motionDuration = {
  immediate: 0.12,
  fast: 0.16,
  standard: 0.22,
  region: 0.32,
} as const;

export const motionEase = {
  standard: [0.2, 0, 0, 1],
  enter: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motionTransition = {
  feedback: { duration: motionDuration.immediate, ease: motionEase.standard },
  enter: { duration: motionDuration.standard, ease: motionEase.enter },
  exit: { duration: motionDuration.fast, ease: motionEase.exit },
} satisfies Record<string, Transition>;

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionTransition.enter },
  exit: { opacity: 0, transition: motionTransition.exit },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: motionTransition.enter },
  exit: { opacity: 0, y: -4, transition: motionTransition.exit },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.05,
    },
  },
};
