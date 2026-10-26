export const initLinkLabels = () => {
	document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
		if (link.matches(".brand-mark, .button-link, .skip-link") || link.closest(".desktop-nav, .menu-panel") || link.querySelector(".link-label")) return;
		const host = link.querySelector("img") ? link.querySelector("h2, h3, strong") : link;
		if (!host) return;
		const label = document.createElement("span");
		label.className = "link-label";
		label.append(...Array.from(host.childNodes));
		host.append(label);
	});
};
