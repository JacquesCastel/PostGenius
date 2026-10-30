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
  ["What LinkeePost is", "LinkeePost (https://postgenius.network) is a web service that helps professionals and agencies write, review, schedule and publish LinkedIn content, and measure its results. Agencies can manage the LinkedIn pages of their own clients and send posts to these clients for approval."],
  ["Information we collect", "Account data (email address, name, encrypted password); the writing profile you provide (business context, tone, preferences); the content you create (posts, campaigns, images, approval comments); usage data needed to apply plan limits; and data received from LinkedIn when you connect an account, as described below."],
  ["Data we receive from LinkedIn", "When you connect a LinkedIn profile or a LinkedIn Page with OAuth 2.0, we receive an access token and basic identification data (your name, profile identifier, and the Pages you administer). Depending on the permissions you grant, we also read your posts, their comments and reactions, and their performance statistics (such as impressions and engagement), and we publish content on your behalf only when you or your team ask us to. We never receive or store your LinkedIn password."],
  ["How we use LinkedIn data", "LinkedIn data is used only to provide the features you requested: publishing the posts you approve, showing the results of your posts, helping you answer comments, and producing performance reports for you or for the client whose page you manage. Comments written by LinkedIn members on your posts are displayed to you; the specific case of comments received on a Page is described in the next section. When you ask for a suggested reply, only the text of the comment (never the name of its author) is sent to our AI provider, solely to draft that reply. We do not sell LinkedIn data, we do not share it with advertisers or data brokers, we do not use it to build profiles of individuals, and we do not use it to train general-purpose AI models."],
  ["Comments received on your Page and the leads list", "When you connect a company Page, LinkeePost reads the comments the Page receives so that we can alert you and show them in the application (notifications and the Leads screen). In line with LinkedIn's data storage requirements, the profile details of a commenter (name, job title) are kept for 24 hours at most, and the comment text for 48 hours at most; after that they are deleted automatically, together with the score computed from them. They are never exported, sold or shared with other customers. To score a lead, only the commenter's job title, company and comment text (never the name) are sent to our AI provider, solely to produce that score. When you ask for a draft outreach message, the commenter's first name is also sent, solely to write that message. Contacts that you type in yourself are not LinkedIn data and are kept until you delete them."],
  ["Content you import (sources and “Second life of a content”)", "You can add sources to your account: links, notes, PDF and Word documents, articles, and content that you ask us to turn into a series of posts. They are stored in your account, analysed by our AI provider to extract facts and draft your posts, and deleted when you delete them or when the account is closed. They are not shared with other customers. You confirm that you have the right to use the content you import; when a content belongs to a third party, LinkeePost rewords the ideas and places the source in the first comment of the post."],
  ["Connected AI assistants", "On the Pro and Agency plans you can connect an AI assistant (for example Claude, ChatGPT with Codex, Claude Code or Cursor) to your account, either by authorising it in a LinkeePost window or with a personal key. At your request, the assistant can read your posts, your schedule, the performance figures that LinkedIn reports for your own posts (such as impressions and reactions) and the coach's advice, and, if you allowed it, create drafts and add sources. It cannot schedule or publish anything, and it never receives the names or the comments of the people who comment on your Page, your leads, your passwords or your LinkedIn tokens. What the assistant receives is then processed by its provider under its own terms; that provider is not our processor, you choose it. Agencies choose which account the assistant works on. We keep only the name of the assistant, the date of connection, the date of last use and the account concerned; keys and tokens are stored as irreversible fingerprints, never in clear. We send you an email at each new connection, and you can remove an assistant at any time in My profile, with immediate effect."],
  ["Why we process data (legal bases)", "To perform our contract with you (provide the service); to meet legal and accounting obligations; and, for service improvement and security, on the basis of our legitimate interest."],
  ["Who we share data with", "Only service providers needed to run the service: Hetzner (hosting, Germany), Neon (database, EU), Anthropic (text generation), OpenAI (image generation and transcription of voice dictation), Brevo (transactional emails), Stripe (payment of subscriptions), Umami (anonymous audience statistics on the public pages), and LinkedIn itself through its official APIs. Content sent to AI providers is limited to what is needed to produce your posts. If you connect an AI assistant, its provider receives what you ask it to read, as described in the section on connected assistants."],
  ["Security", "Data is transmitted over HTTPS. LinkedIn access tokens are stored encrypted. Access to client workspaces is restricted to the people authorised by the account owner, and agency owners can limit which team members see which clients."],
  ["Retention and deletion", "We keep your data while your account is active and delete it within 30 days after the account is closed. LinkedIn access tokens expire automatically (about 60 days). You can delete the LinkedIn data we hold at any time from LinkeePost (Connections, Delete my LinkedIn data): this disconnects LinkedIn and erases the tokens, post statistics, interaction history and tagged people. You can also revoke access from LinkedIn: Settings, Data privacy, Permitted services. Deleted data may remain in our backups for up to 14 days, until they are rotated. Server logs are limited in size and rotated. To request deletion of everything, write to the contact address below."],
  ["Your rights", "If you are in the European Economic Area or the United Kingdom, you have the right to access, correct, delete and export your data, and to object to or restrict its processing. Contact us at the address below; we answer within one month. You may also lodge a complaint with your data protection authority (in France, the CNIL: cnil.fr)."],
  ["Cookies and audience measurement", "LinkeePost uses only strictly necessary cookies (for example the session cookie that keeps you signed in). We use no advertising cookies. On the public pages of the website (never inside the application) we measure audience with Umami, a cookie-free tool: it records page views and the country and device type of visitors, stores no IP address and no identifier that follows you from one site to another, and honours your browser's Do Not Track setting. These statistics are anonymous and are kept for at most 13 months."],
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
