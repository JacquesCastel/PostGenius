"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, ZoomIn, RotateCw, Check, RefreshCw } from "lucide-react";

// Éditeur d'image (crop / redimensionnement / filtres) — utilisé pour les
// images importées par l'utilisateur ET pour retoucher une image déjà
// générée par l'IA. Tout le rendu final passe par un canvas HTML : le
// résultat exporté est toujours un PNG, quel que soit le format d'origine.

const ASPECTS = [
  { id: "free", label: "Libre", value: null },
  { id: "square", label: "1:1", value: 1 },
  { id: "portrait", label: "4:5", value: 4 / 5 },
  { id: "landscape", label: "16:9", value: 16 / 9 },
];

const FILTERS = [
  { id: "none", label: "Original", css: "" },
  { id: "bw", label: "Noir & blanc", css: "grayscale(100%)" },
  { id: "sepia", label: "Sépia", css: "sepia(75%)" },
  { id: "vivid", label: "Vif", css: "saturate(160%) contrast(112%)" },
  { id: "soft", label: "Doux", css: "contrast(92%) brightness(106%) saturate(88%)" },
  { id: "contrast", label: "Contraste+", css: "contrast(135%)" },
];

const WIDTHS = [
  { id: "original", label: "Taille d'origine", value: null },
  { id: "1200", label: "1200 px", value: 1200 },
  { id: "800", label: "800 px", value: 800 },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Recette standard react-easy-crop : dessine la zone recadrée (avec
// rotation) sur un canvas intermédiaire, puis ré-échantillonne à la
// largeur cible en appliquant le filtre CSS choisi.
async function exportImage(src, croppedAreaPixels, rotation, filterCss, targetWidth) {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  // Canvas 1 : image entière tournée, assez grand pour ne rien perdre
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rotatedW = img.width * cos + img.height * sin;
  const rotatedH = img.width * sin + img.height * cos;
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = rotatedW;
  rotCanvas.height = rotatedH;
  const rotCtx = rotCanvas.getContext("2d");
  rotCtx.translate(rotatedW / 2, rotatedH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

  // Canvas 2 : recadrage + filtre + redimensionnement final
  const cropW = croppedAreaPixels.width;
  const cropH = croppedAreaPixels.height;
  const outW = targetWidth || cropW;
  const outH = outW * (cropH / cropW);

  const out = document.createElement("canvas");
  out.width = Math.round(outW);
  out.height = Math.round(outH);
  const ctx = out.getContext("2d");
  if (filterCss) ctx.filter = filterCss;
  ctx.drawImage(
    rotCanvas,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    cropW,
    cropH,
    0,
    0,
    out.width,
    out.height
  );
  return out.toDataURL("image/png", 0.92);
}

export default function ImageEditor({ src, onSave, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(ASPECTS[0]);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [exporting, setExporting] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => setCroppedAreaPixels(areaPixels), []);

  const apply = async () => {
    if (!croppedAreaPixels || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await exportImage(src, croppedAreaPixels, rotation, filter.css, width.value);
      await onSave(dataUrl);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold">Retoucher l'image</p>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="relative w-full h-72 bg-gray-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect.value || 4 / 3}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            style={{ containerStyle: { filter: filter.css || undefined } }}
          />
        </div>

        <div className="p-4 space-y-3 max-h-[45vh] overflow-y-auto">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Cadrage</p>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAspect(a)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    aspect.id === a.id ? "bg-[#ff5a5f] text-white border-[#ff5a5f]" : "border-gray-200 text-gray-600"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn size={15} className="text-gray-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#ff5a5f]"
            />
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="text-gray-500 hover:text-gray-800 p-1.5 shrink-0"
              title="Rotation 90°"
            >
              <RotateCw size={16} />
            </button>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Filtre</p>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    filter.id === f.id ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Largeur d'export</p>
            <div className="flex flex-wrap gap-1.5">
              {WIDTHS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWidth(w)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    width.id === w.id ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-600 hover:border-gray-300 text-sm font-medium py-2 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={apply}
            disabled={exporting || !croppedAreaPixels}
            className="flex-1 bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
