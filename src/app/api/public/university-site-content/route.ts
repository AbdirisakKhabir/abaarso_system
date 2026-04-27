import { NextResponse } from "next/server";

/** Public WordPress site — content mirrored for the student portal (server-side fetch avoids browser CORS). */
const WP_JSON = "https://abaarsotechuniversity.org/wp-json";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=300",
  };
}

function stripWpHtml(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…")
    .replace(/&#\d+;/g, "");
}

type WpPage = {
  slug: string;
  title: string;
  excerpt: string;
};

async function fetchWpPage(slug: string): Promise<WpPage | null> {
  const r = await fetch(
    `${WP_JSON}/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=slug,title,excerpt,content`,
    { next: { revalidate: 300 } }
  );
  if (!r.ok) return null;
  const arr: Array<{
    slug?: string;
    title?: { rendered?: string };
    excerpt?: { rendered?: string };
    content?: { rendered?: string };
  }> = await r.json();
  const p = Array.isArray(arr) ? arr[0] : null;
  if (!p?.slug) return null;
  const excerptRaw = p.excerpt?.rendered ?? "";
  const contentRaw = p.content?.rendered ?? "";
  const excerpt = stripWpHtml(excerptRaw);
  const fromContent = stripWpHtml(contentRaw);
  const text =
    excerpt ||
    (fromContent.length > 800 ? `${fromContent.slice(0, 797)}…` : fromContent);
  return {
    slug: p.slug,
    title: stripWpHtml(p.title?.rendered ?? ""),
    excerpt: text,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  try {
    const indexRes = await fetch(`${WP_JSON}/`, { next: { revalidate: 300 } });
    if (!indexRes.ok) {
      return NextResponse.json(
        { error: "University site unreachable" },
        { status: 502, headers: corsHeaders() }
      );
    }
    const index: {
      name?: string;
      description?: string;
      url?: string;
    } = await indexRes.json();

    const site = {
      name: index.name ?? "Abaarso Tech University",
      tagline: index.description ?? "",
      url: index.url ?? "https://abaarsotechuniversity.org/",
    };

    const [about, welcome] = await Promise.all([
      fetchWpPage("about"),
      fetchWpPage("welcome"),
    ]);

    return NextResponse.json(
      {
        source: "https://abaarsotechuniversity.org/",
        site,
        pages: { about, welcome },
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    console.error("university-site-content:", e);
    return NextResponse.json(
      { error: "Unable to load university website content" },
      { status: 502, headers: corsHeaders() }
    );
  }
}
