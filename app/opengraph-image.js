import { ImageResponse } from "next/og";

// Image d'aperçu des liens partagés (LinkedIn, Slack, messageries) : 1200 × 630
export const alt = "LinkeePost : votre expertise, vos mots, vos posts LinkedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 55%, #ffe4e6 100%)", color: "#1b2a4a" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: "#ff5a5f", color: "#fff", fontSize: 54, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>LP</div>
          <div style={{ marginLeft: 26, fontSize: 56, fontWeight: 800 }}>LinkeePost</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 70, fontWeight: 800, lineHeight: 1.1, display: "flex" }}>Votre expertise, vos mots, vos posts</div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#475569", display: "flex" }}>Des posts LinkedIn écrits à partir de ce que vous savez</div>
        <div style={{ position: "absolute", bottom: 48, right: 90, fontSize: 28, color: "#ff5a5f", fontWeight: 700, display: "flex" }}>postgenius.network</div>
      </div>
    ),
    { ...size }
  );
}
