import React from "react";

function BookLoader() {
  return (
    <div className="book-loader">
      <div className="book-loader-scene">
        <div className="bl-book">
          <div className="bl-half bl-left">
            <div className="bl-line" style={{ width: "72%" }} />
            <div className="bl-line" style={{ width: "55%" }} />
            <div className="bl-line" style={{ width: "80%" }} />
            <div className="bl-line" style={{ width: "60%" }} />
            <div className="bl-line" style={{ width: "68%" }} />
          </div>
          <div className="bl-spine" />
          <div className="bl-half bl-right">
            <div className="bl-line" style={{ width: "75%" }} />
            <div className="bl-line" style={{ width: "58%" }} />
            <div className="bl-line" style={{ width: "82%" }} />
            <div className="bl-line" style={{ width: "63%" }} />
            <div className="bl-line" style={{ width: "70%" }} />
          </div>
          <div className="bl-page" />
        </div>
      </div>
      <p className="book-loader-label">Loading your library…</p>
    </div>
  );
}

export default BookLoader;
