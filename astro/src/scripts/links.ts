export const initLinkLabels = () => {
	document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
		if (link.matches(".brand-mark, .button-link, .skip-link") || link.closest(".desktop-nav, .menu-panel") || link.querySelector("img, .link-label")) return;
		const label = document.createElement("span");
		label.className = "link-label";
		label.append(...Array.from(link.childNodes));
		link.append(label);
	});
};
