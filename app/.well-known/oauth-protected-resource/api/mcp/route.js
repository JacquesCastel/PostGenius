import { GET as handler, OPTIONS as preflight } from "../../route";

// Même document, à l'adresse qui reprend le chemin de la ressource (RFC 9728, § 3.1)
export const dynamic = "force-dynamic";
export const GET = handler;
export const OPTIONS = preflight;
