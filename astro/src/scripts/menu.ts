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

	gsap.killTweensOf([menuPanel, ...menuItems]);
	menuToggle.setAttribute("aria-expanded", String(isOpen));
	menuPanel.setAttribute("aria-hidden", String(!isOpen));

	if (isOpen) {
		menuPanel.classList.add("is-open");
		document.documentElement.style.overflow = "hidden";
		(window as WindowWithLenis).uidLenis?.stop();

		if (!shouldAnimate) {
			gsap.set([menuPanel, ...menuItems], { clearProps: "all" });
			gsap.set(menuPanel, { autoAlpha: 1, y: 0 });
			return;
		}

		gsap.fromTo(menuPanel, { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.24, ease: "power3.out" });
		gsap.fromTo(
			menuItems,
			{ y: 18, autoAlpha: 0 },
			{ y: 0, autoAlpha: 1, duration: 0.28, ease: "power3.out", stagger: 0.04, delay: 0.04 },
		);
		return;
	}

	menuPanel.classList.remove("is-open");

	const finishClose = () => {
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

	gsap.to(menuItems, { y: -6, autoAlpha: 0, duration: 0.12, ease: "power2.out", stagger: 0.015 });
	gsap.to(menuPanel, { y: -10, autoAlpha: 0, duration: 0.16, ease: "power2.out", onComplete: finishClose });
};

export const initMenu = () => {
	const menuToggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
	const menuPanel = document.querySelector<HTMLElement>("[data-menu-panel]");
	if (!menuToggle || !menuPanel) return;

	const closeMenu = () => setMenuState(false, menuToggle, menuPanel, false);

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
