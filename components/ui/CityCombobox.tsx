"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import cityData from "@/lib/data/cities.json";
const { cities } = cityData;

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (city: string) => void;
};
const canonical = (value: string) =>
  cities.find((city) => city.toLowerCase() === value.toLowerCase()) ?? "";

/** Draft text never enters FormData: only a selected city (or empty) does. */
export function CityCombobox({
  value,
  defaultValue = "",
  onChange,
  name,
  id,
  className = "",
  ...props
}: Props) {
  const uid = useId();
  const listId = `${uid}-cities`;
  const [selection, setSelection] = useState(canonical(defaultValue));
  const selected = value === undefined ? selection : canonical(value);
  const [draft, setDraft] = useState(selected);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [above, setAbove] = useState(false);
  const [panelHeight, setPanelHeight] = useState(240);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const results = cities.filter(
    (city) => !filtering || city.toLowerCase().includes(draft.toLowerCase()),
  );
  useEffect(() => {
    setDraft(selected);
  }, [selected]);
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const bounds = input.current?.getBoundingClientRect();
      if (!bounds) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const below = bottom - bounds.bottom - 12;
      const above = bounds.top - top - 12;
      const flip = below < 240 && above > below;
      setAbove(flip);
      setPanelHeight(Math.max(48, Math.min(240, flip ? above : below)));
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setDraft(selected);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open, selected]);
  useEffect(() => {
    const row = list.current?.children[active] as HTMLElement | undefined;
    const panel = list.current;
    if (!row || !panel) return;
    if (row.offsetTop < panel.scrollTop) panel.scrollTop = row.offsetTop;
    else if (
      row.offsetTop + row.offsetHeight >
      panel.scrollTop + panel.clientHeight
    )
      panel.scrollTop = row.offsetTop + row.offsetHeight - panel.clientHeight;
  }, [active]);
  function choose(city: string) {
    setSelection(city);
    onChange?.(city);
    setDraft(city);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div
      ref={root}
      className="relative min-w-0 w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setDraft(selected);
        }
      }}
    >
      <input
        type="hidden"
        name={name}
        value={selected}
        disabled={props.disabled}
      />
      <input
        {...props}
        ref={input}
        id={id ?? uid}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && active >= 0 ? `${uid}-${active}` : undefined
        }
        value={draft}
        className={`min-h-12 w-full min-w-0 max-w-full rounded-control border border-deep/30 bg-paper px-space-3 py-space-3 font-ui text-body font-normal text-ink placeholder:text-deep/70 focus-visible:outline-deep aria-[invalid=true]:border-danger ${className}`}
        onFocus={() => {
          setOpen(true);
          setFiltering(false);
          setActive(-1);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          setFiltering(true);
          setOpen(true);
          setActive(-1);
          if (!event.target.value) {
            setSelection("");
            onChange?.("");
          }
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((current) =>
              results.length
                ? ((current < 0 && event.key === "ArrowUp" ? 0 : current) +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    results.length) %
                  results.length
                : -1,
            );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const city =
              results[active] ??
              results.find(
                (city) => city.toLowerCase() === draft.toLowerCase(),
              );
            if (city) choose(city);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setDraft(selected);
          }
        }}
      />
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Cities"
          style={{ maxHeight: panelHeight }}
          className={`absolute inset-x-0 ${above ? "bottom-full mb-1" : "top-full mt-1"} z-50 overflow-y-auto overscroll-contain rounded-card border border-sage/20 bg-paper text-ink`}
        >
          {results.map((city, index) => (
            <li
              key={city}
              id={`${uid}-${index}`}
              role="option"
              aria-selected={city === selected}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(city)}
              className={`flex min-h-12 cursor-pointer items-center break-words px-space-3 py-space-3 text-body font-normal ${active === index ? "bg-signal/20" : city === selected ? "bg-deep/10" : ""}`}
            >
              {city}
            </li>
          ))}
          {!results.length && (
            <li role="presentation" className="p-space-3 text-small text-deep">
              No matching cities. Try another name.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
