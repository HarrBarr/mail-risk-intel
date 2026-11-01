import type { CSSProperties } from "react";

import { entityMeta } from "@/lib/entities";

import styles from "./EntityIcon.module.css";
import { Icon } from "./Icon";

/** Rounded tile tinted with the entity type's color (same hue as its graph node). */
export function EntityIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" | "lg" }) {
  const meta = entityMeta(type);
  const px = size === "sm" ? 14 : size === "lg" ? 20 : 16;
  return (
    <span className={`${styles.tile} ${styles[size]}`} style={{ "--tone": meta.hex } as CSSProperties}>
      <Icon name={meta.icon} size={px} />
    </span>
  );
}
