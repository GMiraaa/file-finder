import { useState, useCallback } from 'react';

/**
 * Delays unmounting to allow a CSS exit animation to play.
 * Returns `closing` (boolean) and `handleClose` (wrapped closer).
 */
export function useClosingAnimation(onClose, duration = 180) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, duration);
  }, [closing, onClose, duration]);

  return { closing, handleClose };
}
