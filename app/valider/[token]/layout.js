// Page privée (lien secret) : ni indexée ni suivie
export const metadata = { title: "Posts à valider — LinkeePost", robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return children;
}
