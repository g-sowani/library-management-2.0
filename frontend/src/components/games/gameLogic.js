import { HANGMAN_FALLBACK_TITLES } from "./wordBanks";

export function pickHangmanWord(books) {
  const candidates = (books || []).filter(
    (b) =>
      b.title.length >= 3 &&
      b.title.length <= 26 &&
      /^[A-Za-z0-9' .,!?:-]+$/.test(b.title)
  );
  if (candidates.length >= 5) {
    const book = candidates[Math.floor(Math.random() * candidates.length)];
    return { answer: book.title.toUpperCase(), book };
  }
  const answer =
    HANGMAN_FALLBACK_TITLES[
      Math.floor(Math.random() * HANGMAN_FALLBACK_TITLES.length)
    ];
  return { answer, book: null };
}

export function shuffleWord(word) {
  let letters = word.split("");
  let shuffled = word;
  let tries = 0;
  while (shuffled === word && tries < 15) {
    letters = [...letters];
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    shuffled = letters.join("");
    tries++;
  }
  return shuffled;
}

// Standard Wordle-style feedback, duplicate-letter safe
export function wordleFeedback(guess, answer) {
  const result = new Array(guess.length).fill("absent");
  const answerLetters = answer.split("");
  const used = new Array(answer.length).fill(false);
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const idx = answerLetters.findIndex((ch, j) => ch === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = "present";
      used[idx] = true;
    }
  }
  return result;
}
