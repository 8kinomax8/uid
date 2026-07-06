type Theme = "dark" | "light";

const setTheme = (theme: Theme, themeToggles: HTMLButtonElement[]) => {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
	try {
		localStorage.setItem("uid-theme", theme);
	} catch {
		// The site still works when storage is unavailable.
	}
	themeToggles.forEach((themeToggle) => {
		themeToggle.setAttribute("aria-pressed", String(theme === "light"));
		themeToggle.setAttribute("aria-label", theme === "light" ? "Passer au thème sombre" : "Passer au thème clair");
	});
};

const toggleTheme = (themeToggle: HTMLButtonElement, themeToggles: HTMLButtonElement[]) => {
	const currentTheme: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
	const nextTheme: Theme = currentTheme === "light" ? "dark" : "light";
	const duration = Number(themeToggle.dataset.themeDuration || 460);
	const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
	const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
	const { top, left, width, height } = themeToggle.getBoundingClientRect();
	const x = left + width / 2;
	const y = top + height / 2;
	const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));
	const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`];
	const root = document.documentElement;

	const applyTheme = () => setTheme(nextTheme, themeToggles);

	if (
		typeof document.startViewTransition !== "function" ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		applyTheme();
		return;
	}

	root.dataset.magicuiThemeVt = "active";
	root.style.setProperty("--magicui-theme-toggle-vt-duration", `${duration}ms`);
	root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);

	const cleanup = () => {
		delete root.dataset.magicuiThemeVt;
		root.style.removeProperty("--magicui-theme-toggle-vt-duration");
		root.style.removeProperty("--magicui-theme-vt-clip-from");
	};

	const transition = document.startViewTransition(applyTheme);
	transition.finished.finally(cleanup);
	transition.ready.then(() => {
		document.documentElement.animate(
			{ clipPath },
			{
				duration,
				easing: "cubic-bezier(0.77, 0, 0.175, 1)",
				fill: "forwards",
				pseudoElement: "::view-transition-new(root)",
			},
		);
	});
};

export const initTheme = () => {
	const themeToggles = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]"));

	themeToggles.forEach((themeToggle) => {
		themeToggle.addEventListener("click", () => toggleTheme(themeToggle, themeToggles));
	});

	setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", themeToggles);
};
