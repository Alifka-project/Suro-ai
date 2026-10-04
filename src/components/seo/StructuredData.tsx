import { BRAND, CONTACT, PROFILE, SECTION_IDS, SITE_URL } from "@/lib/site";
import { PACKAGES } from "@/lib/packages";
import { FAQS } from "@/lib/faq-content";

/**
 * The page's title and descriptions, shared by the <head> metadata
 * (app/layout.tsx), the web manifest and the structured data below, so search
 * results, link previews and schema.org all describe the site the same way.
 */
export const SEO_TITLE = `${BRAND.name} — Business Automation & AI Solutions in ${CONTACT.city}`;

/** Search-result snippet. Kept to about 155–160 characters so it isn't truncated. */
export const SEO_DESCRIPTION =
  "We automate repetitive work, connect your systems, sort out data and reporting, and build AI assistants and custom apps. Based in Dubai, working across the GCC.";

/** Link-preview text (OpenGraph, X/Twitter): the client's line first. */
export const SHARE_DESCRIPTION = `${BRAND.tagline} Automation, integration and AI for any business function, based in ${CONTACT.city}.`;

const HOME = `${SITE_URL}/`;
const ORG_ID = `${HOME}#organization`;
const WEBSITE_ID = `${HOME}#website`;
const WEBPAGE_ID = `${HOME}#webpage`;
const LOGO_ID = `${HOME}#logo`;

/** Mirrors CONTACT.serviceArea ("across the GCC, Europe and Asia"), with the home country first. */
const AREA_SERVED = [
  { "@type": "Country", name: CONTACT.country },
  { "@type": "Place", name: "Gulf Cooperation Council (GCC)" },
  { "@type": "Place", name: "Europe" },
  { "@type": "Place", name: "Asia" },
];

/** Only published once the client has confirmed a real number (see CONTACT.whatsapp). */
const telephone = CONTACT.whatsapp ? { telephone: CONTACT.whatsapp } : {};

const organization = {
  "@type": ["Organization", "ProfessionalService"],
  "@id": ORG_ID,
  name: BRAND.name,
  url: HOME,
  logo: {
    "@type": "ImageObject",
    "@id": LOGO_ID,
    url: `${SITE_URL}/brand/suloai-mark-square.png`,
    contentUrl: `${SITE_URL}/brand/suloai-mark-square.png`,
    width: 512,
    height: 512,
    caption: BRAND.name,
  },
  image: { "@id": LOGO_ID },
  slogan: BRAND.tagline,
  description: `${BRAND.descriptor} consultancy in ${CONTACT.city}. ${PROFILE.summary}`,
  email: CONTACT.email,
  ...telephone,
  address: {
    "@type": "PostalAddress",
    addressLocality: CONTACT.city,
    addressCountry: CONTACT.countryCode,
  },
  areaServed: AREA_SERVED,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: CONTACT.email,
    ...telephone,
    url: `${HOME}#${SECTION_IDS.contact}`,
  },
  knowsAbout: [
    "Business process automation",
    "Excel and VBA automation",
    "Power Automate",
    "Systems integration",
    "Data reporting and dashboards",
    "AI agents",
    "Custom web applications",
    "Supply chain and logistics",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: `${BRAND.name} services`,
    url: `${HOME}#${SECTION_IDS.services}`,
    itemListElement: PACKAGES.map((p) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        "@id": `${HOME}#service-${p.id}`,
        name: p.name,
        alternateName: p.formLabel,
        description: `${p.promise} Best for: ${p.bestFor}`,
        url: `${HOME}#service-${p.id}`,
        provider: { "@id": ORG_ID },
      },
    })),
  },
};

const website = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: HOME,
  name: BRAND.name,
  description: BRAND.tagline,
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
};

/**
 * The home page, which also carries the FAQ. One node with both types (rather
 * than a second page entity for the same URL) is how schema.org expects a page
 * that is partly an FAQ to be described.
 */
const webpage = {
  "@type": ["WebPage", "FAQPage"],
  "@id": WEBPAGE_ID,
  url: HOME,
  name: SEO_TITLE,
  description: SEO_DESCRIPTION,
  inLanguage: "en",
  isPartOf: { "@id": WEBSITE_ID },
  about: { "@id": ORG_ID },
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const GRAPH = {
  "@context": "https://schema.org",
  "@graph": [organization, website, webpage],
};

/**
 * "<" is escaped as < so no string in the data can close the script tag
 * early (the approach the Next.js JSON-LD guide recommends). Built once at
 * module load: everything in it is static.
 */
const JSON_LD = JSON.stringify(GRAPH).replace(/</g, "\\u003c");

/**
 * schema.org structured data for the landing page: the business, the site,
 * the page with its FAQ, and the ten service packages. No ratings, reviews or
 * prices: none have been published, so none are claimed.
 */
export function StructuredData() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />;
}
