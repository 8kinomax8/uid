export const initCursor = () => {
	const cursor = document.querySelector<HTMLElement>("[data-wand-cursor]");
	const tip = document.querySelector<HTMLElement>("[data-wand-tip]");
	const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
	if (!cursor || !supportsFinePointer) return;

	document.documentElement.classList.add("has-custom-cursor");

	window.addEventListener("pointermove", (event) => {
		[cursor, tip].forEach((element) => {
			element?.style.setProperty("--cursor-x", `${event.clientX}px`);
			element?.style.setProperty("--cursor-y", `${event.clientY}px`);
			element?.classList.add("is-visible");
		});
	});

	window.addEventListener("pointerleave", () => [cursor, tip].forEach((element) => element?.classList.remove("is-visible")));
};
