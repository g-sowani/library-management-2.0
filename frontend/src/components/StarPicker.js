import React from "react";

function StarPicker({ value, hover, onRate, onHover, onLeave }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star ${star <= (hover || value) ? "star-filled" : ""}`}
          onClick={() => onRate(value === star ? 0 : star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          title={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default StarPicker;
