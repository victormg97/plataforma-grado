/**
 * Smart tooltip positioning with viewport edge-collision handling.
 *
 * Given a trigger rect and the tooltip bubble size, it picks the best placement
 * (flipping to the opposite side when the preferred one would overflow) and
 * clamps the bubble within the viewport. It also returns the arrow offset so the
 * arrow keeps pointing at the trigger even after the bubble is clamped.
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipLayout {
  placement: TooltipPlacement;
  /** Viewport (fixed) coordinates for the bubble's top-left corner. */
  top: number;
  left: number;
  /**
   * Distance (px) from the bubble's start edge to the arrow center.
   * For top/bottom it's measured from the left edge; for left/right from the top.
   */
  arrow: number;
}

interface Size {
  width: number;
  height: number;
}

interface Options {
  margin?: number;
  offset?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function computeTooltipPosition(
  trigger: DOMRect,
  bubble: Size,
  preferred: TooltipPlacement,
  { margin = 8, offset = 6 }: Options = {},
): TooltipLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let placement = preferred;

  // Flip to the opposite side only when the preferred side overflows AND the
  // opposite side has room — otherwise keep the preferred side and clamp.
  const fitsTop = trigger.top - bubble.height - offset >= margin;
  const fitsBottom = trigger.bottom + bubble.height + offset <= vh - margin;
  const fitsLeft = trigger.left - bubble.width - offset >= margin;
  const fitsRight = trigger.right + bubble.width + offset <= vw - margin;

  if (placement === 'top' && !fitsTop && fitsBottom) placement = 'bottom';
  else if (placement === 'bottom' && !fitsBottom && fitsTop) placement = 'top';
  else if (placement === 'left' && !fitsLeft && fitsRight) placement = 'right';
  else if (placement === 'right' && !fitsRight && fitsLeft) placement = 'left';

  let top = 0;
  let left = 0;
  let arrow = 0;

  if (placement === 'top' || placement === 'bottom') {
    top = placement === 'top'
      ? trigger.top - offset - bubble.height
      : trigger.bottom + offset;
    const centerX = trigger.left + trigger.width / 2;
    left = clamp(centerX - bubble.width / 2, margin, Math.max(margin, vw - margin - bubble.width));
    arrow = clamp(centerX - left, 10, Math.max(10, bubble.width - 10));
  } else {
    left = placement === 'left'
      ? trigger.left - offset - bubble.width
      : trigger.right + offset;
    const centerY = trigger.top + trigger.height / 2;
    top = clamp(centerY - bubble.height / 2, margin, Math.max(margin, vh - margin - bubble.height));
    arrow = clamp(centerY - top, 10, Math.max(10, bubble.height - 10));
  }

  return { placement, top, left, arrow };
}
