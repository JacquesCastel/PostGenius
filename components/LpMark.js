// Logo LinkeePost : monogramme L + P. Hérite de la couleur (currentColor),
// donc s'utilise en blanc dans la pastille corail comme l'ancienne icône.
export default function LpMark({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* L */}
      <path d="M8 7v18h7" />
      {/* P */}
      <path d="M19 25V8h5a4.5 4.5 0 0 1 0 9h-5" />
    </svg>
  );
}
