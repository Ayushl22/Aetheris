export default function AetherisLogo({
  size = 36,
  wordmark = false,
  tagline = false,
  className = ""
}) {
  return (
    <span className={`aetheris-logo ${className}`.trim()}>
      <svg
        className="aetheris-logo-mark"
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        role={wordmark ? undefined : "img"}
        aria-label={wordmark ? undefined : "Aetheris"}
        aria-hidden={wordmark ? "true" : undefined}
      >
        <rect x="1" y="1" width="34" height="34" rx="10" fill="#241F28" stroke="#403747" />
        <circle cx="8" cy="10" r="1.6" fill="#B8A4C2" />
        <circle cx="8" cy="18" r="1.6" fill="#8F7D9B" />
        <circle cx="8" cy="26" r="1.6" fill="#75677F" />
        <path d="M10.5 10h2.2c3.5 0 3.6 4.6 6.4 7" stroke="#B8A4C2" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.5 18h6" stroke="#9D89A8" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.5 26h2.2c3.5 0 3.6-4.6 6.4-7" stroke="#81708F" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m20 13.7 4.3 4.3-4.3 4.3-4.3-4.3 4.3-4.3Z" fill="#8F7B9D" stroke="#C8B8CF" strokeWidth="1.1" />
        <path d="M24.5 18H28" stroke="#A99AB0" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="29" cy="18" r="2" fill="#79A28B" stroke="#B6CDBF" strokeWidth=".8" />
      </svg>

      {wordmark && (
        <span className="aetheris-logo-copy">
          <strong>Aetheris</strong>
          {tagline && <small>Reliable background infrastructure.</small>}
        </span>
      )}
    </span>
  );
}
