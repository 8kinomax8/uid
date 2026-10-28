import test from 'node:test';
import assert from 'node:assert/strict';
import { initDeferredImages } from '../src/scripts/deferred-images.ts';

test('gallery waits for page load, queues visible images serially and survives errors', t => {
 const requests: string[] = [];
 class Image extends EventTarget {
  dataset: {deferredSrc?: string};
  constructor(src: string) { super(); this.dataset = {deferredSrc: src}; }
  set src(value: string) { requests.push(value); }
 }
 const images = ['a.jpg', 'b.jpg', 'c.jpg'].map(src => new Image(src));
 const browser = new EventTarget();
 let observerCallback: (entries: any[]) => void = () => {};
 class Observer {
  constructor(callback: (entries: any[]) => void) { observerCallback = callback; }
  observe() {}
  unobserve() {}
 }
 const originals = ['window', 'document', 'IntersectionObserver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
 t.after(() => originals.forEach(([key, descriptor]) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key)));
 Object.defineProperties(globalThis, {
  window: {configurable: true, value: Object.assign(browser, {IntersectionObserver: Observer})},
  document: {configurable: true, value: {readyState: 'loading', querySelectorAll: () => images}},
  IntersectionObserver: {configurable: true, value: Observer},
 });
 initDeferredImages();
 assert.deepEqual(requests, []);
 browser.dispatchEvent(new Event('load'));
 assert.deepEqual(requests, []); // no visible gallery images yet
 observerCallback(images.map(target => ({target, isIntersecting: true})));
 assert.deepEqual(requests, ['a.jpg']);
 observerCallback([{target: images[2], isIntersecting: false}]); // scrolled away while queued
 images[0].dispatchEvent(new Event('load'));
 assert.deepEqual(requests, ['a.jpg', 'b.jpg']);
 images[1].dispatchEvent(new Event('error'));
 assert.deepEqual(requests, ['a.jpg', 'b.jpg']);
 observerCallback([{target: images[2], isIntersecting: true}]);
 assert.deepEqual(requests, ['a.jpg', 'b.jpg', 'c.jpg']);
 images[2].dispatchEvent(new Event('load'));
 observerCallback(images.map(target => ({target, isIntersecting: true})));
 assert.equal(requests.length, 3); // each image is requested once

 // Older browsers without IntersectionObserver still load one image at a time.
 Reflect.deleteProperty(browser, 'IntersectionObserver');
 images.forEach((image, index) => { image.dataset.deferredSrc = `fallback-${index}`; });
 Object.defineProperty(globalThis, 'document', {configurable: true, value: {readyState:'complete', querySelectorAll: () => images}});
 initDeferredImages();
 assert.equal(requests.at(-1), 'fallback-0');
 images[0].dispatchEvent(new Event('error'));
 assert.equal(requests.at(-1), 'fallback-1');
 images[1].dispatchEvent(new Event('load'));
 assert.equal(requests.at(-1), 'fallback-2');
 images[2].dispatchEvent(new Event('load'));
});
