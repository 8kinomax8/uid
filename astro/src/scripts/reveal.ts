import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const clearRevealProps = "transform,clipPath,opacity,visibility,willChange";

const revealElement = (target: HTMLElement) => {
	if (target.matches(".events-grid, .agenda-list")) {
		gsap.fromTo(
			target.querySelectorAll(".event-card"),
			{ y: 28, autoAlpha: 0, scale: 0.985 },
			{ y: 0, autoAlpha: 1, scale: 1, duration: 0.54, ease: "power3.out", stagger: 0.06, clearProps: clearRevealProps },
		);
		return;
	}

	if (target.matches(".formation-links")) {
		gsap.fromTo(
			target.querySelectorAll("a"),
			{ y: 26, autoAlpha: 0, scale: 0.985, clipPath: "inset(0 0 12% 0)" },
			{
				y: 0,
				autoAlpha: 1,
				scale: 1,
				clipPath: "inset(0 0 0% 0)",
				duration: 0.58,
				ease: "power3.out",
				stagger: 0.07,
				clearProps: clearRevealProps,
			},
		);
		return;
	}

	if (target.matches(".detail-grid")) {
		gsap.fromTo(
			target.children,
			{ y: 22, autoAlpha: 0 },
			{ y: 0, autoAlpha: 1, duration: 0.46, ease: "power3.out", stagger: 0.06, clearProps: clearRevealProps },
		);
		return;
	}

	if (target.matches(".photo-wall__item")) {
		gsap.fromTo(
			target,
			{ y: 20, autoAlpha: 0, scale: 0.97, clipPath: "inset(0 0 10% 0)" },
			{
				y: 0,
				autoAlpha: 1,
				scale: 1,
				clipPath: "inset(0 0 0% 0)",
				duration: 0.54,
				ease: "power3.out",
				clearProps: clearRevealProps,
			},
		);
		return;
	}

	if (target.matches(".content-flow__aside")) {
		const media = target.querySelector("img");
		const facts = target.querySelectorAll(".fact-list li");

		gsap.fromTo(target, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.52, ease: "power3.out", clearProps: clearRevealProps });

		if (media) {
			gsap.fromTo(
				media,
				{ scale: 1.04, clipPath: "inset(0 0 14% 0)" },
				{ scale: 1, clipPath: "inset(0 0 0% 0)", duration: 0.72, ease: "power3.out", clearProps: "transform,clipPath,willChange" },
			);
		}

		if (facts.length) {
			gsap.fromTo(
				facts,
				{ y: 10, autoAlpha: 0 },
				{ y: 0, autoAlpha: 1, duration: 0.34, ease: "power2.out", stagger: 0.04, delay: 0.12, clearProps: clearRevealProps },
			);
		}

		return;
	}

	gsap.fromTo(target, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.52, ease: "power3.out", clearProps: clearRevealProps });
};

const initPageArrival = () => {
	const leadElements = document.querySelectorAll<HTMLElement>(".home-hero__content, .hero-badge, .page-hero__content");
	const heroMedia = document.querySelector<HTMLElement>(".page-hero__media img");

	gsap.from("[data-header]", {
		y: -14,
		autoAlpha: 0,
		duration: 0.42,
		ease: "power3.out",
		delay: 0.08,
		clearProps: clearRevealProps,
	});

	if (heroMedia) {
		gsap.fromTo(
			heroMedia,
			{ scale: 1.045, autoAlpha: 0.86 },
			{ scale: 1, autoAlpha: 1, duration: 0.82, ease: "power3.out", clearProps: "transform,opacity,visibility" },
		);
	}

	if (!leadElements.length) return;

	gsap.from(leadElements, {
		y: 24,
		autoAlpha: 0,
		duration: 0.62,
		stagger: 0.08,
		ease: "power3.out",
		delay: 0.12,
		clearProps: clearRevealProps,
	});
};

const getScrollRevealTargets = () => {
	return Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], .events-grid, .agenda-list")).filter(
		(target) => !target.matches(".page-hero__content"),
	);
};

const prepareRevealTarget = (target: HTMLElement) => {
	if (target.matches(".events-grid, .agenda-list")) {
		gsap.set(target.querySelectorAll(".event-card"), { y: 28, autoAlpha: 0, scale: 0.985, willChange: "transform, opacity" });
		return;
	}

	if (target.matches(".formation-links")) {
		gsap.set(target.querySelectorAll("a"), { y: 26, autoAlpha: 0, scale: 0.985, clipPath: "inset(0 0 12% 0)", willChange: "transform, opacity" });
		return;
	}

	if (target.matches(".detail-grid")) {
		gsap.set(target.children, { y: 22, autoAlpha: 0, willChange: "transform, opacity" });
		return;
	}

	if (target.matches(".photo-wall__item")) {
		gsap.set(target, { y: 20, autoAlpha: 0, scale: 0.97, clipPath: "inset(0 0 10% 0)", willChange: "transform, opacity" });
		return;
	}

	if (target.matches(".content-flow__aside")) {
		gsap.set(target, { y: 22, autoAlpha: 0, willChange: "transform, opacity" });
		gsap.set(target.querySelector("img"), { scale: 1.04, clipPath: "inset(0 0 14% 0)", willChange: "transform" });
		gsap.set(target.querySelectorAll(".fact-list li"), { y: 10, autoAlpha: 0, willChange: "transform, opacity" });
		return;
	}

	gsap.set(target, { y: 24, autoAlpha: 0, willChange: "transform, opacity" });
};

export const initRevealAnimations = () => {
	const mm = gsap.matchMedia();

	mm.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, (context) => {
		if (context.conditions?.reduceMotion) {
			gsap.set("[data-header], .home-hero__content, .hero-badge, [data-reveal], .event-card, .photo-wall__item", {
				autoAlpha: 1,
				clearProps: clearRevealProps,
			});
			return;
		}

		initPageArrival();

		const scrollRevealTargets = getScrollRevealTargets();
		if (!scrollRevealTargets.length) return;

		scrollRevealTargets.forEach(prepareRevealTarget);

		ScrollTrigger.batch(scrollRevealTargets, {
			start: "top 86%",
			once: true,
			interval: 0.08,
			batchMax: 6,
			onEnter: (targets) => targets.forEach((target) => revealElement(target as HTMLElement)),
		});

		requestAnimationFrame(() => ScrollTrigger.refresh());
	});
};
