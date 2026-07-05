export const initCursor = () => {
	const cursor = document.querySelector<HTMLElement>("[data-wand-cursor]");
	const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
	if (!cursor || !supportsFinePointer) return;

	document.documentElement.classList.add("has-custom-cursor");

	window.addEventListener("pointermove", (event) => {
		cursor.style.setProperty("--cursor-x", `${event.clientX}px`);
		cursor.style.setProperty("--cursor-y", `${event.clientY}px`);
		cursor.classList.add("is-visible");
	});

	window.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
};
