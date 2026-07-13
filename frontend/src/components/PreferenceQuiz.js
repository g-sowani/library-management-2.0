import React, { useState } from 'react';
import api from '../api';
import { GENRES } from '../constants';

function NoCoverPlaceholder({ title, className }) {
  return (
    <div className={`no-cover-placeholder${className ? ` ${className}` : ''}`}>
      <span className="no-cover-title">{title}</span>
    </div>
  );
}

function CompassIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

// Steps: 'welcome' -> 'genres' -> 'loading' -> 'results'
function PreferenceQuiz({ username, onFinish, onOpenBook }) {
  const [step, setStep] = useState('welcome');
  const [selected, setSelected] = useState([]);
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');

  const toggleGenre = (genre) => {
    setSelected((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const skip = async () => {
    await api.post('/auth/onboarding/skip').catch(() => {});
    onFinish();
  };

  const submit = async () => {
    setStep('loading');
    setError('');
    try {
      await api.post('/auth/onboarding', { genres: selected });
      const recs = await api.get('/recommendations').catch(() => ({ data: [] }));
      setBooks(recs.data);
      setStep('results');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong, please try again.');
      setStep('genres');
    }
  };

  const openBook = (bookId) => {
    onOpenBook(bookId);
    onFinish();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card quiz-card">
        {step !== 'loading' && step !== 'results' && (
          <button className="onboarding-skip" onClick={skip}>Skip</button>
        )}

        {step === 'welcome' && (
          <div className="onboarding-content tour-tooltip-anim">
            <div className="onboarding-icon-badge"><CompassIcon /></div>
            <div className="onboarding-eyebrow">Getting Started</div>
            <h3 className="onboarding-title">Welcome, {username}</h3>
            <p className="onboarding-body">
              Answer one quick question and we'll pull together a first set of
              recommendations from the catalogue for you.
            </p>
            <div className="onboarding-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setStep('genres')}>Let's go</button>
            </div>
          </div>
        )}

        {step === 'genres' && (
          <div className="onboarding-content tour-tooltip-anim">
            <div className="onboarding-eyebrow">1 of 1</div>
            <h3 className="onboarding-title">What do you like to read?</h3>
            <p className="onboarding-body">Pick as many genres as you like.</p>
            <div className="quiz-genre-grid">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className={`quiz-genre-chip${selected.includes(genre) ? ' quiz-genre-chip-active' : ''}`}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
            {error && <div className="quiz-error">{error}</div>}
            <div className="onboarding-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setStep('welcome')}>Back</button>
              <button className="btn btn-sm" disabled={selected.length === 0} onClick={submit}>
                Show me books
              </button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="onboarding-content quiz-loading">
            <p className="onboarding-body">Finding books you'll like…</p>
          </div>
        )}

        {step === 'results' && (
          <div className="onboarding-content tour-tooltip-anim">
            <div className="onboarding-eyebrow">All Set</div>
            <h3 className="onboarding-title">Picked for you</h3>
            {books.length === 0 ? (
              <p className="onboarding-body">
                No matches in the catalogue yet for those genres — browse the
                full collection to find your next read.
              </p>
            ) : (
              <div className="books-grid quiz-results-grid">
                {books.map((book) => (
                  <button key={book.id} className="rec-card" onClick={() => openBook(book.id)}>
                    {book.cover_url ? (
                      <img src={book.cover_url} alt="" className="rec-card-cover" />
                    ) : (
                      <NoCoverPlaceholder title={book.title} className="rec-card-cover" />
                    )}
                    <div className="rec-card-reason">{book.reason}</div>
                    <div className="rec-card-title">{book.title}</div>
                    <div className="rec-card-author">{book.author}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="onboarding-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={onFinish}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreferenceQuiz;
