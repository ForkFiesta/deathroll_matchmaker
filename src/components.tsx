import { useEffect, useRef, type ReactNode } from 'react';
import {
  Axe,
  Crosshair,
  Flame,
  Heart,
  Leaf,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
  X,
} from 'lucide-react';
import type { Profile } from '../shared/types';

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 3 43 14v21L24 46 5 35V14Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m5 14 19 11 19-11M24 25v21M24 3v22M5 35l19-10 19 10"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="m24 3 9 16-9 6-9-6Z" fill="currentColor" opacity=".18" />
    </svg>
  );
}
const classIcons = {
  Warrior: Axe,
  Paladin: Shield,
  Hunter: Crosshair,
  Rogue: Swords,
  Priest: Heart,
  Shaman: Sparkles,
  Mage: WandSparkles,
  Warlock: Flame,
  Druid: Leaf,
};
export function Avatar({
  player,
  large = false,
}: {
  player: Pick<Profile, 'className'>;
  large?: boolean;
}) {
  const Icon = classIcons[player.className];
  return (
    <span className={`avatar avatar-${player.className.toLowerCase()} ${large ? 'large' : ''}`}>
      <Icon size={large ? 32 : 23} strokeWidth={1.4} />
    </span>
  );
}
export function Gold({ amount, suffix = 'g' }: { amount: number | string; suffix?: string }) {
  return (
    <span className="gold">
      {amount}
      <span className="gold-suffix">{suffix}</span>
    </span>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const target = dialog.current;
    target?.showModal();
    return () => target?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DiceArt() {
  return (
    <div className="dice-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <svg className="hero-die" viewBox="0 0 300 280" fill="none">
        <defs>
          <linearGradient
            id="die-top"
            x1="80"
            y1="30"
            x2="200"
            y2="160"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f0d89f" />
            <stop offset="1" stopColor="#b99458" />
          </linearGradient>
          <linearGradient
            id="die-left"
            x1="54"
            y1="90"
            x2="150"
            y2="252"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ba985f" />
            <stop offset="1" stopColor="#765830" />
          </linearGradient>
          <linearGradient
            id="die-right"
            x1="250"
            y1="110"
            x2="155"
            y2="250"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#d4b071" />
            <stop offset="1" stopColor="#9b7339" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="20" stdDeviation="15" floodOpacity=".35" />
          </filter>
        </defs>
        <g filter="url(#shadow)" stroke="#ead29d" strokeWidth="1">
          <path d="m146 32 105 57-3 116-102 61-100-61V89Z" fill="url(#die-left)" />
          <path d="m146 32 105 57-105 63L46 89Z" fill="url(#die-top)" />
          <path d="m146 152 105-63-3 116-102 61Z" fill="url(#die-right)" />
        </g>
        <g fill="#513d24">
          <ellipse cx="116" cy="85" rx="12" ry="7" transform="rotate(-2 116 85)" />
          <ellipse cx="174" cy="96" rx="12" ry="7" transform="rotate(-2 174 96)" />
          <ellipse cx="96" cy="181" rx="10" ry="15" transform="rotate(-25 96 181)" />
          <ellipse cx="176" cy="158" rx="9" ry="13" transform="rotate(24 176 158)" />
          <ellipse cx="220" cy="132" rx="9" ry="13" transform="rotate(24 220 132)" />
          <ellipse cx="197" cy="187" rx="9" ry="13" transform="rotate(24 197 187)" />
          <ellipse cx="174" cy="235" rx="9" ry="13" transform="rotate(24 174 235)" />
          <ellipse cx="220" cy="207" rx="9" ry="13" transform="rotate(24 220 207)" />
        </g>
      </svg>
      <span className="dice-spark spark-one">✦</span>
      <span className="dice-spark spark-two">✧</span>
      <span className="dice-caption">FORTUNE FAVORS THE FAIR.</span>
    </div>
  );
}
