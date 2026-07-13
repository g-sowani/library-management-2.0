import React from "react";

function NoCoverPlaceholder({ title, className }) {
  return (
    <div className={`no-cover-placeholder${className ? ` ${className}` : ""}`}>
      <span className="no-cover-title">{title}</span>
    </div>
  );
}

export default NoCoverPlaceholder;
