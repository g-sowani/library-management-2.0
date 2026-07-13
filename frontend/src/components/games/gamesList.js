import { HangmanGameIcon, ScrambleGameIcon, WordleGameIcon } from "./icons";

export const GAMES_LIST = [
  {
    id: "hangman",
    name: "Book Title Hangman",
    tagline: "Guess a title from the catalogue, one letter at a time.",
    Icon: HangmanGameIcon,
  },
  {
    id: "scramble",
    name: "Word Scramble",
    tagline: "Unscramble jumbled library & literary vocabulary.",
    Icon: ScrambleGameIcon,
  },
  {
    id: "wordle",
    name: "Lit Wordle",
    tagline: "Guess the 5-letter literary word in 6 tries.",
    Icon: WordleGameIcon,
  },
];
