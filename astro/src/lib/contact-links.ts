export type LinkedTextChunk = {
	text: string;
	href?: string;
};

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?\d[\d\s().-]{6,}\d)/;

export const linkContactText = (value: string): LinkedTextChunk[] => {
	const chunks: LinkedTextChunk[] = [];
	let remaining = value;

	while (remaining) {
		const matches = [remaining.match(emailPattern), remaining.match(phonePattern)]
			.filter((match): match is RegExpMatchArray => Boolean(match))
			.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
		const match = matches[0];

		if (!match || match.index === undefined) {
			chunks.push({ text: remaining });
			break;
		}

		if (match.index > 0) chunks.push({ text: remaining.slice(0, match.index) });

		const text = match[0];
		const isEmail = emailPattern.test(text);
		chunks.push({
			text,
			href: isEmail ? `mailto:${text}` : `tel:${text.replace(/[^\d+]/g, "")}`,
		});
		remaining = remaining.slice(match.index + text.length);
	}

	return chunks;
};
