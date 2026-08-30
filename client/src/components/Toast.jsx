import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setMessage(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  const ToastEl = (
    <div className={`toast ${message ? "show" : ""}`}>
      <span className="dotgreen"></span>
      <span>{message}</span>
    </div>
  );

  return [ToastEl, showToast];
}
