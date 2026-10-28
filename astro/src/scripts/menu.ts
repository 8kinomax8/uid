import gsap from "gsap";

type WindowWithLenis = Window & {
	uidLenis?: {
		start: () => void;
		stop: () => void;
	};
};

const getMenuItems = (menuPanel: HTMLElement) =>
	Array.from(menuPanel.querySelectorAll<HTMLElement>(".menu-panel__label, .menu-panel__group, .menu-panel__theme"));

const setMenuState = (isOpen: boolean, menuToggle: HTMLButtonElement, menuPanel: HTMLElement, animate = true) => {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const shouldAnimate = animate && !reduceMotion;
	const menuItems = getMenuItems(menuPanel);

	const wasVisible = menuPanel.classList.contains("is-open");
	gsap.killTweensOf([menuPanel, ...menuItems]);
	menuToggle.setAttribute("aria-expanded", String(isOpen));
	menuPanel.setAttribute("aria-hidden", String(!isOpen));
	menuPanel.inert = !isOpen;
	const label = menuToggle.querySelector(".sr-only");
	if (label) label.textContent = isOpen ? "Fermer le menu" : "Ouvrir le menu";
	document.querySelectorAll<HTMLElement>("main, .site-footer").forEach((element) => { element.inert = isOpen; });

	if (isOpen) {
		menuPanel.classList.add("is-open");
		document.documentElement.style.overflow = "hidden";
		(window as WindowWithLenis).uidLenis?.stop();

		if (!shouldAnimate) {
			gsap.set([menuPanel, ...menuItems], { clearProps: "all" });
			gsap.set(menuPanel, { autoAlpha: 1, y: 0 });
			return;
		}

		if (!wasVisible) {
			gsap.set(menuPanel, { y: -20, autoAlpha: 0 });
			gsap.set(menuItems, { y: 16, autoAlpha: 0 });
		}
		gsap.to(menuPanel, { y: 0, autoAlpha: 1, duration: 0.38, ease: "power2.out" });
		gsap.to(menuItems, { y: 0, autoAlpha: 1, duration: 0.42, ease: "power2.out", stagger: 0.035, delay: 0.06 });
		return;
	}

	const finishClose = () => {
		menuPanel.classList.remove("is-open");
		document.documentElement.style.overflow = "";
		(window as WindowWithLenis).uidLenis?.start();
		gsap.set(menuPanel, { clearProps: "all" });
		gsap.set(menuItems, { clearProps: "all" });
	};

	if (!shouldAnimate) {
		gsap.set(menuPanel, { autoAlpha: 0, y: -8 });
		finishClose();
		return;
	}

	gsap.to(menuItems, { y: -6, autoAlpha: 0, duration: 0.18, ease: "power2.out", stagger: 0.015 });
	gsap.to(menuPanel, { y: -10, autoAlpha: 0, duration: 0.24, ease: "power2.out", onComplete: finishClose });
};

export const initMenu = () => {
	const menuToggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
	const menuPanel = document.querySelector<HTMLElement>("[data-menu-panel]");
	if (!menuToggle || !menuPanel) return;

	const closeMenu = () => setMenuState(false, menuToggle, menuPanel, false);

	menuToggle.addEventListener("click", (event) => {
		const opening = menuToggle.getAttribute("aria-expanded") !== "true";
		setMenuState(opening, menuToggle, menuPanel, event.detail !== 0);
		if (opening && event.detail === 0) menuPanel.querySelector<HTMLAnchorElement>("a")?.focus();
	});

	document.querySelectorAll<HTMLElement>("[data-menu-link]").forEach((link) => {
		link.addEventListener("click", closeMenu);
	});

	window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
		if (event.matches) closeMenu();
	});

	document.addEventListener("keydown", (event) => {
		if (menuToggle.getAttribute("aria-expanded") !== "true") return;
		if (event.key === "Escape") {
			closeMenu();
			menuToggle.focus();
		}
		if (event.key === "Tab") {
			const controls = [menuToggle, ...menuPanel.querySelectorAll<HTMLElement>("a[href], button")];
			const index = controls.indexOf(document.activeElement as HTMLElement);
			if (event.shiftKey && index <= 0) {
				event.preventDefault();
				controls.at(-1)?.focus();
			} else if (!event.shiftKey && (index === controls.length - 1 || index < 0)) {
				event.preventDefault();
				menuToggle.focus();
			}
		}
	});
};
