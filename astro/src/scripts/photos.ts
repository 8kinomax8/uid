let activePhotoIndex = 0;

export const initPhotoLightbox = () => {
	const lightbox = document.querySelector<HTMLDialogElement>("[data-photo-lightbox]");
	const image = document.querySelector<HTMLImageElement>("[data-photo-lightbox-image]");
	const openButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-photo-open]"));
	if (!lightbox || !image || openButtons.length === 0) return;

	const syncLightboxControls = () => {
		if (!lightbox.open || image.naturalWidth === 0 || image.naturalHeight === 0) return;

		const dialogRect = lightbox.getBoundingClientRect();
		const imageBox = image.getBoundingClientRect();
		const imageRatio = image.naturalWidth / image.naturalHeight;
		const boxRatio = imageBox.width / imageBox.height;
		const margin = Math.max(12, Math.min(18, window.innerWidth * 0.025));

		const renderedWidth = boxRatio > imageRatio ? imageBox.height * imageRatio : imageBox.width;
		const renderedHeight = boxRatio > imageRatio ? imageBox.height : imageBox.width / imageRatio;
		const renderedLeft = imageBox.left + (imageBox.width - renderedWidth) / 2;
		const renderedTop = imageBox.top + (imageBox.height - renderedHeight) / 2;

		lightbox.style.setProperty("--lightbox-image-top", `${renderedTop - dialogRect.top + margin}px`);
		lightbox.style.setProperty("--lightbox-image-right", `${dialogRect.right - (renderedLeft + renderedWidth) + margin}px`);
	};

	const showPhoto = (index: number) => {
		activePhotoIndex = (index + openButtons.length) % openButtons.length;
		const button = openButtons[activePhotoIndex];
		const src = button.dataset.photoSrc;
		if (!src) return;

		image.src = src;
		image.alt = button.dataset.photoAlt ?? "";
		if (image.complete) requestAnimationFrame(syncLightboxControls);
	};

	const closeLightbox = () => {
		if (lightbox.open) lightbox.close();
	};

	openButtons.forEach((button, index) => {
		button.addEventListener("click", () => {
			showPhoto(index);
			lightbox.showModal();
			document.documentElement.classList.add("has-photo-lightbox");
			requestAnimationFrame(syncLightboxControls);
		});
	});

	document.querySelector<HTMLButtonElement>("[data-photo-close]")?.addEventListener("click", closeLightbox);
	document.querySelector<HTMLButtonElement>("[data-photo-prev]")?.addEventListener("click", () => showPhoto(activePhotoIndex - 1));
	document.querySelector<HTMLButtonElement>("[data-photo-next]")?.addEventListener("click", () => showPhoto(activePhotoIndex + 1));

	lightbox.addEventListener("click", (event) => {
		if (event.target === lightbox) closeLightbox();
	});

	lightbox.addEventListener("close", () => {
		document.documentElement.classList.remove("has-photo-lightbox");
	});

	image.addEventListener("load", syncLightboxControls);
	window.addEventListener("resize", syncLightboxControls);

	lightbox.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft") showPhoto(activePhotoIndex - 1);
		if (event.key === "ArrowRight") showPhoto(activePhotoIndex + 1);
	});
};
