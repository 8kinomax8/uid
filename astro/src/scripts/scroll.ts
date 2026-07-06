import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

type WindowWithLenis = Window & {
	uidLenis?: Lenis;
};

export const initSmoothScroll = () => {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

	const lenis = new Lenis({
		lerp: 0.085,
		wheelMultiplier: 0.9,
		touchMultiplier: 1,
		anchors: {
			offset: -92,
			duration: 0.72,
		},
	});

	(window as WindowWithLenis).uidLenis = lenis;
	lenis.on("scroll", ScrollTrigger.update);

	gsap.ticker.add((time) => {
		lenis.raf(time * 1000);
	});
	gsap.ticker.lagSmoothing(0);

	window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

	return lenis;
};
