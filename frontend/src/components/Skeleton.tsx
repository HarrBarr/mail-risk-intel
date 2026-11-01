import type { CSSProperties } from "react";

import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  pill?: boolean;
}

export function Skeleton({ width = "100%", height = 12, pill = false }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={pill ? `${styles.skeleton} ${styles.pill}` : styles.skeleton}
      style={{ width, height }}
    />
  );
}
