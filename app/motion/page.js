import BrandMotion from "@/components/BrandMotion";

// Animation de 39 secondes plein cadre : pour la visionner seule, ou la rendre en vidéo (?record=1, temps piloté image par image).
export const metadata = {
  title: "LinkeePost en 40 secondes",
  robots: { index: false, follow: false },
};

export default async function MotionPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "calc(100vh * 16 / 9)" }}>
        <BrandMotion record={sp?.record === "1"} />
      </div>
    </div>
  );
}
