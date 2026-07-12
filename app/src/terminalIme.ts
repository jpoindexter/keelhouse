export const imeCaretStyle = (cx: number, cy: number, cw: number, ch: number) => ({
  transform: `translate(${cx * cw}px, ${cy * ch}px)`,
  width: `${cw}px`,
  height: `${ch}px`,
});
