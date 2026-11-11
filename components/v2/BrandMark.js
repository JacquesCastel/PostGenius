import LpMark from "../LpMark";
import { BRAND_NAME } from "@/lib/brand";

// Pastille et nom de la marque pour le nouveau site. Le monogramme « V » n'est utilisé que si le nom « Vercéa » est adopté ;
// d'ici là, le monogramme actuel (L et P) reste dans une pastille claire. Le « é » de Vercéa est mis en rose.
export function BrandName({ className = "" }) {
  if (BRAND_NAME === "Vercéa") return <span className={className}>Verc<span style={{ color: "#C2456F" }}>é</span>a</span>;
  return <span className={className}>{BRAND_NAME}</span>;
}

export default function BrandMark({ size = 36 }) {
  if (BRAND_NAME === "Vercéa") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill="#F6E3E0" />
        <path d="M11 14 L20 28 L29 14" stroke="#C2456F" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="29" cy="12" r="2.6" fill="#2E1F33" />
      </svg>
    );
  }
  return (
    <span className="flex items-center justify-center rounded-full bg-[#F6E3E0] text-[#C2456F]" style={{ width: size, height: size }}>
      <LpMark size={Math.round(size * 0.55)} />
    </span>
  );
}
