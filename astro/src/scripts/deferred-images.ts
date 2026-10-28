// Start gallery requests only after the page's primary resources, one at a time.
// Images away from the viewport never enter the queue (important on slow links).
export const initDeferredImages = () => {
	const images = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-deferred-src]"));
	if (!images.length) return;
	const start = () => {
		const waiting = new Set<HTMLImageElement>();
		let busy = false;
		const pump = () => {
			if (busy || !waiting.size) return;
			const image = waiting.values().next().value!;
			waiting.delete(image);
			const src = image.dataset.deferredSrc;
			if (!src) { pump(); return; }
			busy = true;
			const done = () => {
				image.removeEventListener("load", done);
				image.removeEventListener("error", done);
				busy = false;
				pump();
			};
			image.addEventListener("load", done, { once: true });
			image.addEventListener("error", done, { once: true });
			delete image.dataset.deferredSrc;
			image.src = src;
		};
		if (!("IntersectionObserver" in window)) {
			images.forEach(image => waiting.add(image));
			pump();
			return;
		}
		const observer = new IntersectionObserver(entries => {
			entries.forEach(entry => {
				const image = entry.target as HTMLImageElement;
				if (entry.isIntersecting && image.dataset.deferredSrc) waiting.add(image);
				else waiting.delete(image);
				if (!image.dataset.deferredSrc) observer.unobserve(image);
			});
			pump();
		}, { rootMargin: "120px" });
		images.forEach(image => observer.observe(image));
	};
	if (document.readyState === "complete") start();
	else window.addEventListener("load", start, { once: true });
};
