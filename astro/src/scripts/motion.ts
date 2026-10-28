import { initDeferredImages } from "./deferred-images";
import { initLinkLabels } from "./links";
import { initEventMedia } from "./event-media";
import { initCursor } from "./cursor";
import { initMenu } from "./menu";
import { initPhotoLightbox } from "./photos";
import { initRevealAnimations } from "./reveal";
import { initSmoothScroll } from "./scroll";
import { initTheme } from "./theme";

initSmoothScroll();
initMenu();
initTheme();
initPhotoLightbox();
initCursor();
initRevealAnimations();

initLinkLabels();
initEventMedia();

initDeferredImages();
