import { redirect } from "next/navigation";

// Adresse courte souvent attendue par les plateformes : renvoie vers la politique de confidentialité en anglais
export default function Privacy() {
  redirect("/privacy-policy");
}
