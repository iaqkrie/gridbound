import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface CellPopoverProps {
  title: string;
  cellX: number;
  cellY: number;
  screenX: number;
  screenY: number;
  containerWidth: number;
  containerHeight: number;
  width: number;
  estimatedHeight: number;
  role?: 'dialog' | 'alertdialog';
  ariaLabel: string;
  closeAriaLabel: string;
  swatchColor?: string;
  onClose: () => void;
  children: ReactNode;
}

export function CellPopover({
  title,
  cellX,
  cellY,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
  width,
  estimatedHeight,
  role = 'dialog',
  ariaLabel,
  closeAriaLabel,
  swatchColor,
  onClose,
  children,
}: CellPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      if (target instanceof HTMLCanvasElement) {
        return;
      }
      onClose();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  const margin = 12;
  let left = screenX + 14;
  let top = screenY - 12;

  if (left + width + margin > containerWidth) {
    left = Math.max(margin, screenX - width - 14);
  }
  if (top + estimatedHeight + margin > containerHeight) {
    top = Math.max(margin, containerHeight - estimatedHeight - margin);
  }
  if (top < margin) {
    top = margin;
  }

  return (
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      style={{
        transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`,
        width: `${width}px`,
      }}
      className="absolute top-0 left-0 z-30 bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1F2A38]">
        <div className="flex items-center gap-2 text-xs min-w-0">
          {swatchColor && (
            <span
              className="w-2.5 h-2.5 rounded-[2px] shrink-0 border border-white/15"
              style={{ backgroundColor: swatchColor }}
              aria-hidden="true"
            />
          )}
          <span className="font-semibold text-[#E6EDF3] truncate">{title}</span>
          <span className="text-[#8B98A9] shrink-0" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-[#8B98A9] shrink-0">
            {cellX}, {cellY}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeAriaLabel}
          className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] rounded transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {children}
    </div>
  );
}
