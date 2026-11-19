import { useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type PressableButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Fareyle üzerine gelindiğinde uygulanacak ölçek. */
  hoverScale?: number;
  /** Basılıyken uygulanacak ölçek. */
  pressScale?: number;
  /** Basılıyken aşağı kayma miktarı (px). */
  pressDepth?: number;
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Dokunmatik ekranda parmak değdiğinde ve fareyle üzerine gelindiğinde
 * hafifçe küçülüp içe çöküyormuş hissi veren buton.
 */
export function PressableButton({
  hoverScale = 0.97,
  pressScale = 0.92,
  pressDepth = 1.5,
  className,
  style,
  disabled,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: PressableButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const reducedMotion = prefersReducedMotion();
  const interactive = !disabled && !reducedMotion;
  const isPressed = interactive && pressed;
  const isHovered = interactive && hovered && !pressed;

  const transform = isPressed
    ? `translateY(${pressDepth}px) scale(${pressScale})`
    : isHovered
      ? `scale(${hoverScale})`
      : undefined;

  return (
    <button
      {...rest}
      className={className}
      disabled={disabled}
      onBlur={(event) => {
        setPressed(false);
        setHovered(false);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === ' ' || event.key === 'Enter')) {
          setPressed(true);
        }
        onKeyDown?.(event);
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          setPressed(false);
        }
        onKeyUp?.(event);
      }}
      onPointerCancel={(event) => {
        setPressed(false);
        setHovered(false);
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        if (!disabled && (event.pointerType !== 'mouse' || event.button === 0)) {
          setPressed(true);
        }
        onPointerDown?.(event);
      }}
      onPointerEnter={(event) => {
        if (!disabled && event.pointerType !== 'touch') {
          setHovered(true);
        }
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setPressed(false);
        setHovered(false);
        onPointerLeave?.(event);
      }}
      onPointerUp={(event) => {
        setPressed(false);
        setHovered(!disabled && event.pointerType !== 'touch');
        onPointerUp?.(event);
      }}
      style={{
        transform,
        filter: isPressed ? 'brightness(0.92)' : undefined,
        transition: reducedMotion
          ? undefined
          : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms ease, background-color 160ms ease, box-shadow 160ms ease, border-color 160ms ease, color 160ms ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
        ...style,
      }}
    />
  );
}
