import { fallbackEvents, type EventItem } from "../data/site";

type WordPressMedia = {
	source_url?: string;
	alt_text?: string;
	media_details?: {
		sizes?: Record<string, { source_url?: string }>;
	};
};

type WordPressPost = {
	id: number;
	link?: string;
	date?: string;
	title?: { rendered?: string };
	excerpt?: { rendered?: string };
	content?: { rendered?: string };
	acf?: Record<string, unknown>;
	_embedded?: {
		"wp:featuredmedia"?: WordPressMedia[];
	};
};

const stripHtml = (value = "") =>
	value
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&eacute;/g, "é")
		.replace(/&egrave;/g, "è")
		.replace(/&agrave;/g, "à")
		.replace(/\s+/g, " ")
		.trim();

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const fallbackEventAt = (index: number) => fallbackEvents[index % fallbackEvents.length] ?? fallbackEvents[0];

const imageFromPost = (post: WordPressPost, index: number) => {
	const media = post._embedded?.["wp:featuredmedia"]?.[0];
	const fallback = fallbackEventAt(index)?.image ?? "/images/event-closeup.webp";
	return media?.media_details?.sizes?.large?.source_url ?? media?.source_url ?? fallback;
};

const endpointFromEnv = (kind: "events" | "agenda") => {
	const base = import.meta.env.WORDPRESS_API_BASE ?? import.meta.env.PUBLIC_WORDPRESS_API_BASE;
	const explicit =
		kind === "events" ? import.meta.env.WORDPRESS_EVENTS_ENDPOINT : import.meta.env.WORDPRESS_AGENDA_ENDPOINT;

	if (explicit) return explicit;
	if (!base) return "";

	const cleaned = String(base).replace(/\/$/, "");
	const postType = kind === "events" ? "events" : "agenda";
	return `${cleaned}/wp-json/wp/v2/${postType}?_embed=1&per_page=12`;
};

type EventMapper = (post: WordPressPost, index: number, acf: Record<string, unknown>, fallback: EventItem) => EventItem;

const fetchWordPressItems = async (kind: "events" | "agenda", limit: number, mapPost: EventMapper): Promise<EventItem[]> => {
	const endpoint = endpointFromEnv(kind);
	if (!endpoint) return fallbackEvents;

	try {
		const response = await fetch(endpoint);
		if (!response.ok) return fallbackEvents;

		const posts = (await response.json()) as WordPressPost[];
		if (!Array.isArray(posts) || posts.length === 0) return fallbackEvents;

		return posts.slice(0, limit).map((post, index) => mapPost(post, index, post.acf ?? {}, fallbackEventAt(index)));
	} catch {
		return fallbackEvents;
	}
};

export const getEvents = () =>
	fetchWordPressItems("events", 6, (post, index, acf, fallback) => ({
		title: stripHtml(post.title?.rendered) || fallback.title,
		date: asString(acf.date) || (post.date ? new Intl.DateTimeFormat("fr-CH").format(new Date(post.date)) : ""),
		location: asString(acf.lieu) || asString(acf.location) || "Delémont",
		summary: stripHtml(asString(acf.resume) || asString(acf.summary) || post.excerpt?.rendered || post.content?.rendered),
		image: imageFromPost(post, index),
		href: post.link ?? "/agenda/",
	}));

export const getAgendaItems = () =>
	fetchWordPressItems("agenda", 12, (post, index, acf, fallback) => ({
		title: stripHtml(post.title?.rendered) || fallback.title,
		date: asString(acf.date_debut) || asString(acf.date) || "",
		location: asString(acf.lieu) || asString(acf.location) || "Delémont",
		summary: stripHtml(post.excerpt?.rendered || post.content?.rendered),
		image: imageFromPost(post, index),
		href: post.link ?? "/agenda/",
	}));
