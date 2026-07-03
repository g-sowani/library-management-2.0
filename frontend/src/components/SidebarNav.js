import React, { useEffect, useState } from "react";
import { Home, BookOpen, Library, Users, UserCircle } from "lucide-react";

const ICONS = {
  home: Home,
  books: BookOpen,
  library: Library,
  community: Users,
  profile: UserCircle,
};

// Distance (px) from the bottom edge of the viewport within which the dock reveals itself.
const REVEAL_ZONE = 110;

function SidebarNav({ tabs, active, onChange, badges = {} }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handlePointerMove = (e) => {
      setVisible(window.innerHeight - e.clientY <= REVEAL_ZONE);
    };
    window.addEventListener("mousemove", handlePointerMove);
    return () => window.removeEventListener("mousemove", handlePointerMove);
  }, []);

  return (
    <nav
      className={`dock-nav${visible ? " dock-nav-visible" : ""}`}
      aria-label="Primary"
    >
      <div className="dock">
        {tabs.map(({ id, label }) => {
          const Icon = ICONS[id];
          const isActive = active === id;
          const badgeCount = badges[id] || 0;
          return (
            <button
              key={id}
              type="button"
              className={`dock-item${isActive ? " dock-item-active" : ""}`}
              onClick={() => onChange(id)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              title={label}
            >
              <span className="dock-icon-wrap">
                {Icon && <Icon size={22} strokeWidth={1.75} />}
                {badgeCount > 0 && (
                  <span className="dock-badge">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className={`dock-dot${isActive ? " dock-dot-active" : ""}`}
              />
              <span className="dock-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default SidebarNav;
