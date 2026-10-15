import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getFooterPage } from "@/lib/footer-pages";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacy Policy — LinkeePost",
  description: "How LinkeePost collects, uses and protects personal data, including data received from LinkedIn.",
  alternates: { canonical: "/privacy-policy" },
};

// English privacy policy (also the URL given to LinkedIn for the developer app). The French version, editable in the
// administration, stays the reference for French law; the data controller details are read from it so they never diverge.
const SECTIONS = [
  ["What LinkeePost is", "LinkeePost (also referred to as PostGenius, https://postgenius.network) is a web service that helps professionals and agencies write, review, schedule and publish LinkedIn content, and measure its results. Agencies can manage the LinkedIn pages of their own clients and send posts to these clients for approval."],
  ["Information we collect", "Account data (email address, name, encrypted password); the writing profile you provide (business context, tone, preferences); the content you create (posts, campaigns, images, approval comments); usage data needed to apply plan limits; and data received from LinkedIn when you connect an account, as described below."],
  ["Data we receive from LinkedIn", "When you connect a LinkedIn profile or a LinkedIn Page with OAuth 2.0, we receive an access token and basic identification data (your name, profile identifier, and the Pages you administer). Depending on the permissions you grant, we also read your posts, their comments and reactions, and their performance statistics (such as impressions and engagement), and we publish content on your behalf only when you or your team ask us to. We never receive or store your LinkedIn password."],
  ["How we use LinkedIn data", "LinkedIn data is used only to provide the features you requested: publishing the posts you approve, showing the results of your posts, helping you answer comments, and producing performance reports for you or for the client whose page you manage. We do not sell LinkedIn data, we do not share it with advertisers or data brokers, we do not use it to build profiles of individuals, and we do not use it to train general-purpose AI models."],
  ["Why we process data (legal bases)", "To perform our contract with you (provide the service); to meet legal and accounting obligations; and, for service improvement and security, on the basis of our legitimate interest."],
  ["Who we share data with", "Only service providers needed to run the service: Hetzner (hosting, Germany), Neon (database, EU), Anthropic (text generation), OpenAI (image generation), Brevo (transactional emails), and LinkedIn itself through its official APIs. Content sent to AI providers is limited to what is needed to produce your posts."],
  ["Security", "Data is transmitted over HTTPS. LinkedIn access tokens are stored encrypted. Access to client workspaces is restricted to the people authorised by the account owner, and agency owners can limit which team members see which clients."],
  ["Retention and deletion", "We keep your data while your account is active and delete it within 30 days after the account is closed. LinkedIn access tokens expire automatically (about 60 days) and are deleted when you disconnect LinkedIn. You can disconnect LinkedIn at any time from LinkeePost, and also from LinkedIn: Settings, Data privacy, Permitted services. To request deletion of your data, write to the contact address below."],
  ["Your rights", "If you are in the European Economic Area or the United Kingdom, you have the right to access, correct, delete and export your data, and to object to or restrict its processing. Contact us at the address below; we answer within one month. You may also lodge a complaint with your data protection authority (in France, the CNIL: cnil.fr)."],
  ["Cookies", "LinkeePost uses only strictly necessary cookies (for example the session cookie that keeps you signed in). We use no advertising cookies and no third-party analytics cookies."],
  ["Children", "The service is intended for professionals and is not directed to anyone under 16."],
  ["Changes to this policy", "We may update this policy; the current version is always available at this address, and we will inform account holders of material changes."],
];

export default async function PrivacyPolicy() {
  const fr = await getFooterPage("confidentialite");
  const controller = fr?.sections?.[0]?.body;
  return (
    <div className="bg-gradient-to-b from-rose-50/60 via-white to-white text-[#1b2a4a] min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-14 flex-1 w-full" lang="en">
        <Link href="/" className="text-sm text-[#ff5a5f] hover:underline">← Back to home</Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">Privacy Policy</h1>
        <p className="text-xs text-gray-400 mb-8">Version française : <Link href="/confidentialite" className="underline">Politique de confidentialité</Link></p>
        <section className="space-y-6 text-sm leading-relaxed">
          {controller && (
            <div>
              <h2 className="font-semibold text-base mb-2">Data controller and contact</h2>
              {controller.split("\n").map((line, j) => <p key={j}>{line}</p>)}
            </div>
          )}
          {SECTIONS.map(([heading, body]) => (
            <div key={heading}>
              <h2 className="font-semibold text-base mb-2">{heading}</h2>
              <p>{body}</p>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
