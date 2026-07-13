import React, { useEffect, useRef, useState } from "react";
import api from "../../../../api";
import NoCoverPlaceholder from "../../../../components/NoCoverPlaceholder";
import ChevronLeft from "../../../../components/icons/ChevronLeft";
import LockIcon from "../../../../components/icons/LockIcon";
import { GAMES_LIST } from "../../../../components/games/gamesList";
import { pickHangmanWord, shuffleWord, wordleFeedback } from "../../../../components/games/gameLogic";
import HangmanFigure from "../../../../components/games/HangmanFigure";
import { SCRAMBLE_WORDS, WORDLE_WORDS, WORDLE_VALID_WORDS } from "../../../../components/games/wordBanks";

const HANGMAN_MAX_WRONG = 6;
const WORDLE_XP_BY_GUESSES = [100, 80, 60, 45, 30, 15];

function GamesTab({ isGold, user, books, updateUser, onOpenBook }) {
  const [gameView, setGameView] = useState("menu"); // 'menu' | 'hangman' | 'scramble' | 'wordle'
  const [hangman, setHangman] = useState(null); // { answer, guessed:Set, wrong, status, xpEarned }
  const [hangmanRevealDismissed, setHangmanRevealDismissed] = useState(false);
  const [scramble, setScramble] = useState(null); // { answer, scrambled, guess, status, hintRevealed, xpEarned }
  const [scrambleHintCooldown, setScrambleHintCooldown] = useState(false);
  const scrambleHintTimeoutRef = useRef(null);
  const [wordle, setWordle] = useState(null); // { answer, guesses:[], current, status, error, xpEarned }

  // Fire-and-forget: awards XP server-side and syncs the new total into user state.
  const awardXp = (amount) => {
    api
      .post("/games/xp", { amount })
      .then((r) => updateUser({ xp: r.data.xp }))
      .catch(() => {});
  };

  const startHangman = () => {
    const { answer, book } = pickHangmanWord(books);
    setHangman({
      answer,
      book,
      guessed: new Set(),
      wrong: 0,
      status: "playing",
      xpEarned: null,
    });
    setHangmanRevealDismissed(false);
  };

  const guessHangmanLetter = (letter) => {
    setHangman((prev) => {
      if (!prev || prev.status !== "playing" || prev.guessed.has(letter))
        return prev;
      const guessed = new Set(prev.guessed);
      guessed.add(letter);
      const wrong = prev.answer.includes(letter) ? prev.wrong : prev.wrong + 1;
      const solved = prev.answer
        .split("")
        .every((ch) => !/[A-Z]/.test(ch) || guessed.has(ch));
      let status = prev.status;
      let xpEarned = prev.xpEarned;
      if (solved) {
        status = "won";
        xpEarned = Math.max(10, 60 - wrong * 10);
        awardXp(xpEarned);
      } else if (wrong >= HANGMAN_MAX_WRONG) {
        status = "lost";
      }
      return { ...prev, guessed, wrong, status, xpEarned };
    });
  };

  useEffect(() => {
    if (gameView !== "hangman") return;
    const handleKeydown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && hangman && hangman.status !== "playing") {
        e.preventDefault();
        startHangman();
        return;
      }
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        guessHangmanLetter(letter);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [gameView, hangman?.status]); // eslint-disable-line

  const startScramble = () => {
    const answer =
      SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
    setScramble({
      answer,
      scrambled: shuffleWord(answer),
      guess: "",
      status: "playing",
      hintRevealed: 0,
      xpEarned: null,
    });
    clearTimeout(scrambleHintTimeoutRef.current);
    setScrambleHintCooldown(false);
  };

  const reshuffleScramble = () => {
    setScramble((prev) =>
      prev ? { ...prev, scrambled: shuffleWord(prev.answer) } : prev
    );
  };

  const revealScrambleHint = () => {
    if (scrambleHintCooldown) return;
    setScramble((prev) =>
      prev && prev.status === "playing"
        ? {
            ...prev,
            hintRevealed: Math.min(
              prev.hintRevealed + 1,
              prev.answer.length - 1
            ),
          }
        : prev
    );
    setScrambleHintCooldown(true);
    clearTimeout(scrambleHintTimeoutRef.current);
    scrambleHintTimeoutRef.current = setTimeout(
      () => setScrambleHintCooldown(false),
      2000
    );
  };

  const submitScrambleGuess = (e) => {
    e.preventDefault();
    setScramble((prev) => {
      if (!prev || prev.status !== "playing") return prev;
      const correct = prev.guess.trim().toUpperCase() === prev.answer;
      let xpEarned = prev.xpEarned;
      if (correct) {
        xpEarned = Math.max(10, 50 - prev.hintRevealed * 15);
        awardXp(xpEarned);
      }
      return { ...prev, status: correct ? "won" : "wrong", xpEarned };
    });
  };

  const startWordle = () => {
    const answer =
      WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    setWordle({
      answer,
      guesses: [],
      current: "",
      status: "playing",
      error: "",
      xpEarned: null,
    });
  };

  const submitWordleGuess = (e) => {
    e.preventDefault();
    setWordle((prev) => {
      if (!prev || prev.status !== "playing" || prev.current.length !== 5)
        return prev;
      const guess = prev.current.toUpperCase();
      if (!WORDLE_VALID_WORDS.has(guess)) {
        return { ...prev, error: "Not a valid word" };
      }
      const guesses = [...prev.guesses, guess];
      let status = prev.status;
      let xpEarned = prev.xpEarned;
      if (guess === prev.answer) {
        status = "won";
        xpEarned = WORDLE_XP_BY_GUESSES[guesses.length - 1];
        awardXp(xpEarned);
      } else if (guesses.length >= 6) {
        status = "lost";
      }
      return { ...prev, guesses, current: "", status, error: "", xpEarned };
    });
  };

  const openGame = (id) => {
    setGameView(id);
    if (id === "hangman") startHangman();
    if (id === "scramble") startScramble();
    if (id === "wordle") startWordle();
  };

  return (
    <>
      {!isGold ? (
        <div className="community-locked">
          <div className="community-locked-icon">
            <LockIcon />
          </div>
          <h3>Gold Members Only</h3>
          <p>Book Games are exclusively for Gold members.</p>
          <p>
            Upgrade your membership to Gold to unlock three classic word
            games with a literary twist.
          </p>
        </div>
      ) : gameView === "menu" ? (
        <>
          <div className="section-header">
            <h3>Gold Games</h3>
            <div className="games-xp-total">{user.xp || 0} XP</div>
          </div>
          <div className="games-grid">
            {GAMES_LIST.map((g) => (
              <div
                key={g.id}
                className="game-card"
                onClick={() => openGame(g.id)}
              >
                <div className="game-card-icon">
                  <g.Icon />
                </div>
                <div className="game-card-name">{g.name}</div>
                <div className="game-card-tagline">{g.tagline}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="game-panel-header">
            <button
              className="back-nav-link"
              onClick={() => setGameView("menu")}
            >
              <ChevronLeft /> Back to Games
            </button>
            <h3>{GAMES_LIST.find((g) => g.id === gameView)?.name}</h3>
          </div>

          <div className="game-panel">
          {gameView === "hangman" && hangman && (
            <div className="hangman-game">
              <HangmanFigure wrong={hangman.wrong} />
              <div className="hangman-word">
                {hangman.answer.split("").map((ch, i) => (
                  <span key={i} className="hangman-letter">
                    {/[A-Z]/.test(ch)
                      ? hangman.guessed.has(ch) ||
                        hangman.status !== "playing"
                        ? ch
                        : "_"
                      : ch === " "
                      ? "  "
                      : ch}
                  </span>
                ))}
              </div>
              {hangman.status === "won" && (
                <div className="game-result game-result-won">
                  You got it! +{hangman.xpEarned} XP
                </div>
              )}
              {hangman.status === "lost" && (
                <div className="game-result game-result-lost">
                  Out of guesses — it was "{hangman.answer}"
                </div>
              )}
              {hangman.status !== "playing" &&
                hangman.book &&
                !hangmanRevealDismissed && (
                  <div className="hangman-reveal-card">
                    <button
                      type="button"
                      className="hangman-reveal-close"
                      aria-label="Cancel"
                      onClick={() => setHangmanRevealDismissed(true)}
                    >
                      &times;
                    </button>
                    <div className="hangman-reveal-cover-wrap">
                      {hangman.book.cover_url ? (
                        <img
                          src={hangman.book.cover_url}
                          alt=""
                          className="hangman-reveal-cover"
                        />
                      ) : (
                        <NoCoverPlaceholder title={hangman.book.title} />
                      )}
                    </div>
                    <div className="hangman-reveal-book-title">
                      {hangman.book.title}
                    </div>
                    <div className="hangman-reveal-book-author">
                      {hangman.book.author}
                    </div>
                    <div className="hangman-reveal-actions">
                      <button
                        className="btn btn-sm"
                        onClick={() => onOpenBook(hangman.book.id)}
                      >
                        Explore
                      </button>
                      <button className="btn btn-sm" onClick={startHangman}>
                        Play Again
                      </button>
                    </div>
                  </div>
                )}
              <div className="game-wrong-count">
                Wrong guesses: {hangman.wrong} / {HANGMAN_MAX_WRONG}
                {hangman.status === "playing" &&
                  " · type a letter to guess"}
              </div>
              <div className="hangman-keyboard">
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                  .split("")
                  .map((letter) => {
                    const used = hangman.guessed.has(letter);
                    const correct =
                      used && hangman.answer.includes(letter);
                    return (
                      <button
                        key={letter}
                        className={`hangman-key ${
                          used
                            ? correct
                              ? "hangman-key-correct"
                              : "hangman-key-wrong"
                            : ""
                        }`}
                        disabled={used || hangman.status !== "playing"}
                        onClick={() => guessHangmanLetter(letter)}
                      >
                        {letter}
                      </button>
                    );
                  })}
              </div>
              {hangman.status !== "playing" && (
                <button className="btn btn-sm" onClick={startHangman}>
                  Play Again
                </button>
              )}
            </div>
          )}

          {gameView === "scramble" && scramble && (
            <div className="scramble-game">
              <div className="scramble-letters">
                {scramble.scrambled.split("").map((ch, i) => (
                  <span key={i} className="scramble-tile">
                    {ch}
                  </span>
                ))}
              </div>
              <div className="scramble-clue">
                {scramble.answer.length} letters · library & literary
                vocabulary
              </div>
              {scramble.hintRevealed > 0 && (
                <div className="scramble-hint-word">
                  {scramble.answer.split("").map((ch, i) => (
                    <span key={i} className="scramble-hint-letter">
                      {i < scramble.hintRevealed ? ch : "_"}
                    </span>
                  ))}
                </div>
              )}
              <form
                className="scramble-form"
                onSubmit={submitScrambleGuess}
              >
                <input
                  type="text"
                  className="scramble-input"
                  value={scramble.guess}
                  onChange={(e) =>
                    setScramble((prev) => ({
                      ...prev,
                      guess: e.target.value,
                    }))
                  }
                  disabled={scramble.status === "won"}
                  placeholder="Your guess…"
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={
                    scramble.status === "won" || !scramble.guess.trim()
                  }
                >
                  Submit
                </button>
              </form>
              {scramble.status === "wrong" && (
                <div className="game-result game-result-lost">
                  Not quite — try again!
                </div>
              )}
              {scramble.status === "won" && (
                <div className="game-result game-result-won">
                  Correct! It was "{scramble.answer}" · +
                  {scramble.xpEarned} XP
                </div>
              )}
              <div className="scramble-actions">
                {scramble.status !== "won" && (
                  <>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={reshuffleScramble}
                    >
                      Reshuffle
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={revealScrambleHint}
                      disabled={scrambleHintCooldown}
                    >
                      Hint
                    </button>
                  </>
                )}
                {scramble.status === "won" && (
                  <button
                    className="btn btn-sm"
                    onClick={startScramble}
                  >
                    Next Word
                  </button>
                )}
              </div>
            </div>
          )}

          {gameView === "wordle" && wordle && (
            <div className="wordle-game">
              <div className="wordle-grid">
                {Array.from({ length: 6 }).map((_, row) => {
                  const guess = wordle.guesses[row];
                  const isCurrentRow =
                    row === wordle.guesses.length &&
                    wordle.status === "playing";
                  const rowLetters = guess
                    ? guess.split("")
                    : isCurrentRow
                    ? wordle.current.padEnd(5, " ").split("")
                    : ["", "", "", "", ""];
                  const feedback = guess
                    ? wordleFeedback(guess, wordle.answer)
                    : null;
                  return (
                    <div key={row} className="wordle-row">
                      {rowLetters.map((ch, i) => (
                        <span
                          key={i}
                          className={`wordle-tile ${
                            feedback
                              ? `wordle-tile-${feedback[i]}`
                              : ch.trim()
                              ? "wordle-tile-filled"
                              : ""
                          }`}
                        >
                          {ch.trim()}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
              {wordle.status === "playing" ? (
                <>
                  <form
                    className="wordle-form"
                    onSubmit={submitWordleGuess}
                  >
                    <input
                      type="text"
                      className="wordle-input"
                      value={wordle.current}
                      maxLength={5}
                      onChange={(e) =>
                        setWordle((prev) => ({
                          ...prev,
                          current: e.target.value
                            .replace(/[^a-zA-Z]/g, "")
                            .toUpperCase(),
                          error: "",
                        }))
                      }
                      placeholder="5-letter word"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="btn btn-sm"
                      disabled={wordle.current.length !== 5}
                    >
                      Guess
                    </button>
                  </form>
                  {wordle.error && (
                    <div className="game-result game-result-lost">
                      {wordle.error}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {wordle.status === "won" && (
                    <div className="game-result game-result-won">
                      Solved in {wordle.guesses.length}/6! +
                      {wordle.xpEarned} XP
                    </div>
                  )}
                  {wordle.status === "lost" && (
                    <div className="game-result game-result-lost">
                      Out of guesses — it was "{wordle.answer}"
                    </div>
                  )}
                  <button className="btn btn-sm" onClick={startWordle}>
                    Play Again
                  </button>
                </>
              )}
            </div>
          )}
          </div>
        </>
      )}
    </>
  );
}

export default GamesTab;
