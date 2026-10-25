// Keep the fixed chat inside the visible area when a mobile keyboard pans or
// resizes the visual viewport. CSS 100dvh remains the no-API fallback.
export function bindChatViewport(
  element: HTMLElement,
  viewport: VisualViewport,
) {
  const update = () => {
    element.style.top = `${Math.max(0, viewport.offsetTop)}px`;
    element.style.height = `${Math.max(0, viewport.height)}px`;
  };
  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    element.style.removeProperty("top");
    element.style.removeProperty("height");
  };
}
