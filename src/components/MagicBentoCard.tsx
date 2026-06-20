import { useRef } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import styles from "./MagicBentoCard.module.css";

interface MagicBentoCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  glowRadius?: number;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  variant?: "default" | "feature";
}

const MagicBentoCard = ({
  children,
  className = "",
  glowColor = "45, 212, 191",
  glowRadius = 220,
  enableTilt = true,
  enableMagnetism = true,
  variant = "default",
}: MagicBentoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const variantClass = variant === "feature" ? styles.featureCard : "";
  const resolvedGlowRadius = variant === "feature" ? Math.max(glowRadius, 260) : glowRadius;
  const baseGlow = variant === "feature" ? 0.45 : 0;
  const hoverGlow = variant === "feature" ? 0.9 : 1;

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;
    const tiltX = enableTilt ? ((y - rect.height / 2) / (rect.height / 2)) * -6 : 0;
    const tiltY = enableTilt ? ((x - rect.width / 2) / (rect.width / 2)) * 6 : 0;
    const magnetX = enableMagnetism ? (x - rect.width / 2) * 0.04 : 0;
    const magnetY = enableMagnetism ? (y - rect.height / 2) * 0.04 : 0;

    cardRef.current.style.setProperty("--glow-x", `${percentX}%`);
    cardRef.current.style.setProperty("--glow-y", `${percentY}%`);
    cardRef.current.style.setProperty("--tilt-x", `${tiltX}deg`);
    cardRef.current.style.setProperty("--tilt-y", `${tiltY}deg`);
    cardRef.current.style.setProperty("--magnet-x", `${magnetX}px`);
    cardRef.current.style.setProperty("--magnet-y", `${magnetY}px`);
    cardRef.current.style.setProperty("--glow-intensity", `${hoverGlow}`);
    cardRef.current.style.setProperty("--lift", "-4px");
  };

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--glow-intensity", `${hoverGlow}`);
    cardRef.current.style.setProperty("--lift", "-4px");
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--glow-intensity", `${baseGlow}`);
    cardRef.current.style.setProperty("--glow-x", "50%");
    cardRef.current.style.setProperty("--glow-y", "50%");
    cardRef.current.style.setProperty("--tilt-x", "0deg");
    cardRef.current.style.setProperty("--tilt-y", "0deg");
    cardRef.current.style.setProperty("--magnet-x", "0px");
    cardRef.current.style.setProperty("--magnet-y", "0px");
    cardRef.current.style.setProperty("--lift", "0px");
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${variantClass} ${className}`.trim()}
      style={
        {
          "--glow-color": glowColor,
          "--glow-radius": `${resolvedGlowRadius}px`,
          "--glow-intensity": `${baseGlow}`,
        } as CSSProperties
      }
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
};

export default MagicBentoCard;
