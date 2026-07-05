const setMenuState = (isOpen: boolean, menuToggle: HTMLButtonElement, menuPanel: HTMLElement) => {
	menuToggle.setAttribute("aria-expanded", String(isOpen));
	menuPanel.setAttribute("aria-hidden", String(!isOpen));
	menuPanel.classList.toggle("is-open", isOpen);
	document.documentElement.style.overflow = isOpen ? "hidden" : "";
};

export const initMenu = () => {
	const menuToggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
	const menuPanel = document.querySelector<HTMLElement>("[data-menu-panel]");
	if (!menuToggle || !menuPanel) return;

	const closeMenu = () => setMenuState(false, menuToggle, menuPanel);

	menuToggle.addEventListener("click", () => {
		setMenuState(menuToggle.getAttribute("aria-expanded") !== "true", menuToggle, menuPanel);
	});

	document.querySelectorAll<HTMLElement>("[data-menu-link]").forEach((link) => {
		link.addEventListener("click", closeMenu);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeMenu();
	});
};
