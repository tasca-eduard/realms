// Wares: the prototype's upgrade shop, sold by village folk whose trade each one fits, so every
// realm's village has something of its own to sell once the sword is as good as its smith makes it.
// Levels go with the knight from realm to realm (save.data.kit).

export interface Ware {
  name: string;
  /** What a level does, for the offer. */
  what: string;
  /** The price of each level in turn. */
  prices: number[];
}

export const WARES: Record<string, Ware> = {
  // The Keep's smith: barding for a mount, one more hit for each piece.
  barding: { name: 'Barding', what: 'your mounts take one more hit', prices: [90, 210] },
  // Whisperwood's weaver: spider silk wrapped round the boots.
  boots: { name: 'Silk-wrapped boots', what: 'faster on foot (+8%)', prices: [80, 200] },
  // Whisperwood's herbwife: a tonic for the blue bar.
  focus: { name: 'Nettle tonic', what: 'the blue bar fills faster (+40%)', prices: [90, 200, 340] },
};
