export function EMedicoIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left earpiece circle */}
      <circle cx="5" cy="5" r="2" fill="#374151" />
      
      {/* Right earpiece circle */}
      <circle cx="19" cy="5" r="2" fill="#374151" />
      
      {/* Left tube from earpiece */}
      <path
        d="M 5 7 Q 5 10 8 12"
        stroke="#374151"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Right tube from earpiece */}
      <path
        d="M 19 7 Q 19 10 16 12"
        stroke="#374151"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Main chest diaphragm - large circle */}
      <circle cx="12" cy="18" r="4.5" fill="none" stroke="#374151" strokeWidth="1.5" />
      
      {/* Inner circle of diaphragm */}
      <circle cx="12" cy="18" r="2.5" fill="#F5F5F5" stroke="#374151" strokeWidth="1" />
    </svg>
  );
}
