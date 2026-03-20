export function AdesIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Document/Page */}
      <path
        d="M5 2 L5 22 C5 23 6 24 7 24 L19 24 C20 24 21 23 21 22 L21 6 L15 2 L7 2 C6 2 5 3 5 4 Z"
        fill="#F5F5F5"
        stroke="#374151"
        strokeWidth="1.5"
      />
      
      {/* Letter A */}
      <g transform="translate(8, 8)">
        {/* Left diagonal of A */}
        <line x1="2" y1="10" x2="6" y2="0" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
        {/* Right diagonal of A */}
        <line x1="6" y1="0" x2="10" y2="10" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
        {/* Horizontal line of A */}
        <line x1="3" y1="6" x2="9" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
