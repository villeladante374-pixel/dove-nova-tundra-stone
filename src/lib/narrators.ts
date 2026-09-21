export type NarratorId = "isabel";

export const NARRATORS: {
  id: NarratorId;
  name: string;
  line: string;
}[] = [
  {
    id: "isabel",
    name: "Isabel",
    line: "Británica",
  },
];

export function readNarrator(): NarratorId {
  return "isabel";
}

export function writeNarrator(_id: NarratorId) {}
