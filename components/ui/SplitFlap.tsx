import type { CSSProperties } from "react";

/** Server-rendered strips: no timers, random hydration mismatch or layout updates. */
export function SplitFlap({
  text,
  offset = 0,
}: {
  text: string;
  offset?: number;
}) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return (
    <span className="split-flap">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="split-flap-letters">
        {Array.from(text).map((character, index) => {
          const position = alphabet.indexOf(character.toUpperCase());
          const frames =
            position < 0
              ? [character]
              : [
                  character,
                  alphabet[(position + 1) % alphabet.length],
                  alphabet[(position + 25) % alphabet.length],
                  alphabet[(position + 2) % alphabet.length],
                  alphabet[(position + 24) % alphabet.length],
                ];
          return (
            <span key={index} className="split-flap-cell">
              <span
                className={position < 0 ? "" : "split-flap-strip"}
                style={
                  {
                    "--flap-delay": `${Math.min(offset + index, 20) * 28}ms`,
                  } as CSSProperties
                }
              >
                {frames.map((frame, step) => (
                  <span className="split-flap-frame" key={step}>
                    {frame === " " ? "\u00a0" : frame}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
