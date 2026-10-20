"use client";
import { useEffect, useRef, useState } from "react";
import { X, AlertCircle, Search } from "lucide-react";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Request failed.");
  return data;
}
export function useData<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    api<T>(path)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      Loading attendance data…
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Progress({ value }: { value: number | null }) {
  return (
    <div className="progress-wrap">
      <div
        className="progress"
        role="progressbar"
        aria-label="Attendance"
        aria-valuenow={value ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          style={{
            width: `${value ?? 0}%`,
            background:
              value !== null && value < 75
                ? "var(--warning)"
                : "var(--primary)",
          }}
        />
      </div>
      <span>{value === null ? "No records" : `${value}%`}</span>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        aria-label="Search by name or roll number"
        placeholder="Search name or roll number…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  message,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <ErrorMessage message={error} />
      <div className="form-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </Modal>
  );
}
