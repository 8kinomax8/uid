export const initLoader = () => {
	const loader = document.querySelector<HTMLElement>("[data-loader]");
	if (!loader) return;

	const timer = window.setTimeout(() => {
		if (document.readyState !== "complete") loader.hidden = false;
	}, 700);

	window.addEventListener(
		"load",
		() => {
			window.clearTimeout(timer);
			loader.hidden = true;
		},
		{ once: true },
	);
};
