"use client";
import { useEffect, useRef } from "react";

// Comment envoyer un lien vers LinkeePost depuis chaque appareil : le favori du navigateur (ordinateur), l'application installée (Android),
// la limite d'iPhone. Utilisé par l'écran de partage et par la carte du tableau de bord.
export default function ShareHowTo({ testId = "share-bookmark" }) {
  const bookmarkRef = useRef(null);
  // Favori du navigateur : posé par le DOM (React refuse les adresses « javascript: » dans un lien)
  useEffect(() => {
    const origin = window.location.origin;
    const code = `javascript:(function(){var s=String(window.getSelection?window.getSelection():'').slice(0,4000);window.open('${origin}/app/share?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+(s?'&text='+encodeURIComponent(s):''),'_blank')})();`;
    bookmarkRef.current?.setAttribute("href", code);
  }, []);
  return (
    <ul className="text-xs text-gray-600 space-y-2">
      <li><strong>Sur ordinateur :</strong> glissez ce bouton dans votre barre de favoris — <a ref={bookmarkRef} onClick={(e) => e.preventDefault()} className="inline-block bg-[#fff1f1] border border-[#ff5a5f] text-[#ff5a5f] font-medium rounded px-2 py-0.5 cursor-grab" data-testid={testId}>Partager vers LinkeePost</a> — puis cliquez dessus depuis n&apos;importe quelle page. Si du texte est sélectionné, il est repris.</li>
      <li><strong>Sur Android :</strong> installez LinkeePost sur l&apos;écran d&apos;accueil (menu du navigateur, « Installer l&apos;application »). « LinkeePost » apparaît ensuite dans le menu Partager.</li>
      <li><strong>Sur iPhone :</strong> le menu Partager ne peut pas encore y mener : copiez l&apos;adresse du post et collez-la dans « Partager un lien ».</li>
    </ul>
  );
}
