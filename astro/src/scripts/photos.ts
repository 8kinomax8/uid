let activePhotoIndex = 0;

export const initPhotoLightbox = () => {
	const lightbox = document.querySelector<HTMLDialogElement>("[data-photo-lightbox]");
	const image = document.querySelector<HTMLImageElement>("[data-photo-lightbox-image]");
	const openButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-photo-open]"));
	if (!lightbox || !image || openButtons.length === 0) return;

	const showPhoto = (index: number) => {
		activePhotoIndex = (index + openButtons.length) % openButtons.length;
		const button = openButtons[activePhotoIndex];
		const src = button.dataset.photoSrc;
		if (!src) return;

		image.src = src;
		image.alt = button.dataset.photoAlt ?? "";
	};

	const closeLightbox = () => {
		if (lightbox.open) lightbox.close();
	};

	openButtons.forEach((button, index) => {
		button.addEventListener("click", () => {
			showPhoto(index);
			lightbox.showModal();
		});
	});

	document.querySelector<HTMLButtonElement>("[data-photo-close]")?.addEventListener("click", closeLightbox);
	document.querySelector<HTMLButtonElement>("[data-photo-prev]")?.addEventListener("click", () => showPhoto(activePhotoIndex - 1));
	document.querySelector<HTMLButtonElement>("[data-photo-next]")?.addEventListener("click", () => showPhoto(activePhotoIndex + 1));

	lightbox.addEventListener("click", (event) => {
		if (event.target === lightbox) closeLightbox();
	});

	lightbox.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft") showPhoto(activePhotoIndex - 1);
		if (event.key === "ArrowRight") showPhoto(activePhotoIndex + 1);
	});
};
