export const initCursor = () => {
	const cursor = document.querySelector<HTMLElement>("[data-wand-cursor]");
	const tip = document.querySelector<HTMLElement>("[data-wand-tip]");
	const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
	if (!cursor || !supportsFinePointer) return;

	document.documentElement.classList.add("has-custom-cursor");
	const hideCursor = () => [cursor, tip].forEach(element => element?.classList.remove("is-visible"));
	document.querySelectorAll<HTMLElement>("iframe, [data-native-cursor]").forEach(frame => {
		frame.addEventListener("pointerenter", () => {
			document.documentElement.classList.add("is-over-native-cursor");
			hideCursor();
		});
		frame.addEventListener("pointerleave", () => document.documentElement.classList.remove("is-over-native-cursor"));
	});
	window.addEventListener("blur", hideCursor);

	window.addEventListener("pointermove", (event) => {
		if (event.target instanceof Element && event.target.closest("iframe, [data-native-cursor]")) return;
		document.documentElement.classList.remove("is-over-native-cursor");
		[cursor, tip].forEach((element) => {
			element?.style.setProperty("--cursor-x", `${event.clientX}px`);
			element?.style.setProperty("--cursor-y", `${event.clientY}px`);
			element?.classList.add("is-visible");
		});
	});

	window.addEventListener("pointerleave", () => [cursor, tip].forEach((element) => element?.classList.remove("is-visible")));
};
