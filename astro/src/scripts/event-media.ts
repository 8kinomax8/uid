import { ScrollTrigger } from "gsap/ScrollTrigger";

export const initEventMedia = () => {
	document.querySelectorAll<HTMLImageElement>(".event-card__media img").forEach((image) => {
		const classify = () => {
			if (!image.naturalWidth) return;
			image.closest(".event-card")?.classList.toggle("event-card--portrait", image.naturalHeight > image.naturalWidth);
			ScrollTrigger.refresh();
		};
		if (image.complete) classify();
		else image.addEventListener("load", classify, { once: true });
	});
};
