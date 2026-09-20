export const planes = Object.freeze([
  { id: "x", axes: [0, 1], offset: [-3.5, 2.8], color: 0x79ded1 },
  { id: "y", axes: [1, 2], offset: [-5, 0.55], color: 0xb6a0ff },
  { id: "z", axes: [0, 2], offset: [3.5, 0.55], color: 0xf6bd77 },
]);
export const maximumWords = 60;
export const cameraPosition = Object.freeze([4, 8, 12]);
export const simulationSettings = Object.freeze({
  spring: 14,
  anchor: 0.7,
  damping: 7,
  maxStep: 1 / 120,
});
