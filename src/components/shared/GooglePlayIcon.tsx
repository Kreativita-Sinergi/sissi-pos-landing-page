import React from "react";

/** Ikon segitiga Google Play satu warna (mengikuti `currentColor`). */
export function GooglePlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2.25 15.375V2.62499C2.25 2.18249 2.505 1.79249 2.88 1.61249L10.2675 8.99999L2.88 16.3875C2.505 16.2 2.25 15.8175 2.25 15.375ZM12.6075 11.34L4.5375 16.005L10.905 9.63749L12.6075 11.34ZM15.12 8.10749C15.375 8.30999 15.5625 8.62499 15.5625 8.99999C15.5625 9.37499 15.3975 9.67499 15.135 9.88499L13.4175 10.875L11.5425 8.99999L13.4175 7.12499L15.12 8.10749ZM4.5375 1.99499L12.6075 6.65999L10.905 8.36249L4.5375 1.99499Z"
        fill="currentColor"
      />
    </svg>
  );
}
