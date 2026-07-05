import gsap from "gsap";

export const initRevealAnimations = () => {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	gsap.from("[data-header]", { y: -14, autoAlpha: 0, duration: 0.5, ease: "power3.out", delay: 0.08 });
	gsap.from(".home-hero__content, .hero-badge", {
		y: 22,
		autoAlpha: 0,
		duration: 0.62,
		stagger: 0.08,
		ease: "power3.out",
		delay: 0.12,
	});

	if (!("IntersectionObserver" in window)) return;

	const revealObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				gsap.fromTo(
					entry.target,
					{ y: 24, autoAlpha: 0 },
					{ y: 0, autoAlpha: 1, duration: 0.58, ease: "power3.out" },
				);
				revealObserver.unobserve(entry.target);
			});
		},
		{ threshold: 0.18 },
	);

	document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((item) => revealObserver.observe(item));
};
