import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useTheme } from "../context/ThemeContext";
import { useLoopingVideo } from "../hooks/useLoopingVideo";
import { HERO_VIDEO_URL } from "../constants";
import { ArrowLeftIcon, ArrowRightIcon } from "../components/Icons";
import BookCarousel from "../components/BookCarousel";
import "../styles/fonts.css";
import "../styles/theme.css";
import "./LandingPage.css";

const ABOUT_FEATURES = [
  {
    title: "Borrow Books",
    desc: "Take a book home and settle in — borrow within your plan's limit for the full loan period.",
    image: "/service_borrow.jpg",
  },
  {
    title: "Reserve a Copy",
    desc: "If every copy's out, join the queue. We'll hold the next one just for you.",
    image: "/service_reserve.jpg",
  },
  {
    title: "AI-Powered Search",
    desc: "Describe the feeling you're chasing, and let our AI find the story that fits.",
    image: "/service_ai_search.jpg",
  },
  {
    title: "Personalised Picks",
    desc: "Recommendations shaped by what you've read, loved, and lingered on.",
    image: "/service_picks.jpg",
  },
  {
    title: "Reading Communities",
    desc: "Gold members gather to talk about the books that keep them up at night.",
    image: "/service_community.jpg",
  },
  {
    title: "Donate & Earn",
    desc: "Pass a book on to its next reader, and earn credit toward your own.",
    image: "/service_donate.jpg",
  },
];

const COMMUNITY_IMAGES = [
  {
    src: "/characters/1.png",
  },
  {
    src: "/characters/2.png",
  },
  {
    src: "/characters/3.png",
  },
  {
    src: "/characters/4.png",
    scale: 0.57,
  },
];

function SunIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { appearance, setAppearance } = useTheme();
  const videoRef = useRef(null);
  const catalogueRef = useRef(null);
  const [previewBooks, setPreviewBooks] = useState([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [activeFeature, setActiveFeature] = useState(0);
  const [rollerDirection, setRollerDirection] = useState("right");
  const [communityIndex, setCommunityIndex] = useState(0);
  const [communityAnimating, setCommunityAnimating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useLoopingVideo(videoRef);

  useEffect(() => {
    api
      .get("/books/preview")
      .then((res) => setPreviewBooks(res.data))
      .catch(() => setPreviewBooks([]))
      .finally(() => setCatalogueLoading(false));
  }, []);

  useEffect(() => {
    ABOUT_FEATURES.forEach((feature) => {
      const img = new Image();
      img.src = feature.image;
    });
  }, []);

  useEffect(() => {
    COMMUNITY_IMAGES.forEach((item) => {
      const img = new Image();
      img.src = item.src;
    });
  }, []);

  useEffect(() => {
    if (catalogueLoading) return undefined;
    const cards = catalogueRef.current?.querySelectorAll(".landing-book-card");
    const carousel = catalogueRef.current?.querySelector(".landing-carousel-root");
    var targets = [];
    if (cards && cards.length) targets = targets.concat(Array.from(cards));
    if (carousel) targets.push(carousel);
    if (!targets.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [previewBooks, catalogueLoading]);

  const goTo = (path, state) => {
    setIsLeaving(true);
    setTimeout(() => navigate(path, state ? { state } : undefined), 280);
  };
  const startReading = () => goTo("/login");
  const goToRegister = () => goTo("/login", { register: true });
  const scrollToCatalogue = () => {
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  };

  const isDark =
    appearance === "dark" ||
    (appearance === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleAppearance = () => setAppearance(isDark ? "light" : "dark");

  const prevFeature = () => {
    setRollerDirection("left");
    setActiveFeature(
      (i) => (i - 1 + ABOUT_FEATURES.length) % ABOUT_FEATURES.length
    );
  };
  const nextFeature = () => {
    setRollerDirection("right");
    setActiveFeature((i) => (i + 1) % ABOUT_FEATURES.length);
  };
  const goToFeature = (i) => {
    setRollerDirection(i > activeFeature ? "right" : "left");
    setActiveFeature(i);
  };

  const prevFeatureIndex =
    (activeFeature - 1 + ABOUT_FEATURES.length) % ABOUT_FEATURES.length;
  const nextFeatureIndex = (activeFeature + 1) % ABOUT_FEATURES.length;

  const navigateCommunity = (direction) => {
    if (communityAnimating) return;
    setCommunityAnimating(true);
    setCommunityIndex((i) =>
      direction === "next"
        ? (i + 1) % COMMUNITY_IMAGES.length
        : (i + 3) % COMMUNITY_IMAGES.length
    );
    setTimeout(() => setCommunityAnimating(false), 650);
  };

  const communityLeftIndex = (communityIndex + 3) % COMMUNITY_IMAGES.length;
  const communityRightIndex = (communityIndex + 1) % COMMUNITY_IMAGES.length;
  const communityRoleOf = (i) => {
    if (i === communityIndex) return "center";
    if (i === communityLeftIndex) return "left";
    if (i === communityRightIndex) return "right";
    return "back";
  };

  return (
    <div
      className={`landing-page${isLeaving ? " landing-page-leaving" : ""}`}
      id="top"
    >
      <div
        className="landing-video-layer"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/video-poster.jpg)`,
        }}
      >
        <video
          ref={videoRef}
          className="landing-video"
          src={HERO_VIDEO_URL}
          autoPlay
          muted
          playsInline
        />
        <div className="landing-video-overlay" />
      </div>

      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">The Athenaeum</div>
          <div className="landing-menu">
            <a
              className="landing-menu-item landing-menu-item-active"
              href="#top"
            >
              Home
            </a>
            <a className="landing-menu-item" href="#about">
              About
            </a>
            <a className="landing-menu-item" href="#community">
              Community
            </a>
            <a className="landing-menu-item" href="#catalogue">
              Catalogue
            </a>
            <a className="landing-menu-item" href="#reach">
              Reach Us
            </a>
          </div>
          <div className="landing-nav-actions">
            <button
              className="landing-theme-toggle"
              onClick={toggleAppearance}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="landing-cta-btn" onClick={goToRegister}>
              Register
            </button>
          </div>
        </div>
      </nav>
      <div className="landing-nav-spacer" />

      <section className="landing-hero">
        <h1 className="landing-headline animate-fade-rise">
          Beyond <em>silence,</em> we keep <em>the stories alive.</em>
        </h1>
        <p className="landing-description animate-fade-rise-delay">
          A home for borrowers, dreamers, and lifelong readers. Through the
          noise, we've built a quiet space to discover, borrow, and share the
          books that shape you.
        </p>
        <button
          className="landing-hero-cta animate-fade-rise-delay-2"
          onClick={scrollToCatalogue}
        >
          Start Reading
        </button>
      </section>

      <section className="landing-about" id="about">
        <div className="landing-about-inner">
          <h2 className="landing-about-title">A library that grows with you</h2>
          <p className="landing-about-subtitle">
            Everything you need to find your next favourite book, all under one
            roof.
          </p>
          <div className="landing-roller">
            <button
              className="landing-roller-peek landing-roller-peek-left"
              onClick={prevFeature}
              aria-label="Previous service"
            >
              <div
                className="landing-roller-peek-image"
                style={{
                  backgroundImage: `url(${ABOUT_FEATURES[prevFeatureIndex].image})`,
                }}
              />
              <div className="landing-roller-peek-title">
                {ABOUT_FEATURES[prevFeatureIndex].title}
              </div>
            </button>

            <div className="landing-roller-card">
              <div
                className={`landing-roller-content landing-roller-content-${rollerDirection}`}
                key={activeFeature}
              >
                <div
                  className="landing-roller-image"
                  style={{
                    backgroundImage: `url(${ABOUT_FEATURES[activeFeature].image})`,
                  }}
                />
                <div className="landing-roller-body">
                  <div className="landing-roller-title">
                    {ABOUT_FEATURES[activeFeature].title}
                  </div>
                  <div className="landing-roller-desc">
                    {ABOUT_FEATURES[activeFeature].desc}
                  </div>
                </div>
              </div>
            </div>

            <button
              className="landing-roller-peek landing-roller-peek-right"
              onClick={nextFeature}
              aria-label="Next service"
            >
              <div
                className="landing-roller-peek-image"
                style={{
                  backgroundImage: `url(${ABOUT_FEATURES[nextFeatureIndex].image})`,
                }}
              />
              <div className="landing-roller-peek-title">
                {ABOUT_FEATURES[nextFeatureIndex].title}
              </div>
            </button>
          </div>

          <div className="landing-roller-dots">
            {ABOUT_FEATURES.map((feature, i) => (
              <button
                key={feature.title}
                className={`landing-roller-dot${
                  i === activeFeature ? " is-active" : ""
                }`}
                onClick={() => goToFeature(i)}
                aria-label={feature.title}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-community" id="community">
        <div className="landing-community-grain" />

        <div className="landing-community-label">COMMUNITY</div>
        {/* <div className="landing-community-ghost">THE CIRCLE</div> */}

        <div className="landing-community-carousel">
          {COMMUNITY_IMAGES.map((item, i) => (
            <div
              key={item.src}
              className={`landing-community-item landing-community-item-${communityRoleOf(
                i
              )}`}
            >
              <img
                src={item.src}
                alt=""
                draggable={false}
                style={{
                  transform: `scale(${item.scale || 1})`,
                  transformOrigin: "bottom center",
                }}
              />
            </div>
          ))}
        </div>

        <div className="landing-community-copy">
          <p className="landing-community-heading">Find Your Circle</p>
          <p className="landing-community-desc">
            Join communities of readers who see the story the way you do. Share
            theories, debate endings, and find the people who get it.
          </p>
          <div className="landing-community-nav-buttons">
            <button
              className="landing-community-arrow-btn"
              onClick={() => navigateCommunity("prev")}
              aria-label="Previous"
            >
              <ArrowLeftIcon size={26} />
            </button>
            <button
              className="landing-community-arrow-btn"
              onClick={() => navigateCommunity("next")}
              aria-label="Next"
            >
              <ArrowRightIcon size={26} />
            </button>
          </div>
        </div>

        <a
          className="landing-community-link"
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            startReading();
          }}
        >
          Join a Community
          <ArrowRightIcon size={28} />
        </a>
      </section>

      {(catalogueLoading || previewBooks.length > 0) && (
        <section
          className="landing-catalogue"
          id="catalogue"
          ref={catalogueRef}
        >
          <h2 className="landing-catalogue-title">The Catalogue</h2>
          <p className="landing-catalogue-subtitle">
            A glimpse of the stories waiting on our shelves.
          </p>
          {catalogueLoading ? (
            <div className="landing-catalogue-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  className="landing-book-card landing-book-skeleton"
                  key={i}
                >
                  <div className="landing-book-cover landing-skeleton-shimmer" />
                  <div className="landing-book-meta">
                    <div className="landing-skeleton-line landing-skeleton-shimmer landing-skeleton-title" />
                    <div className="landing-skeleton-line landing-skeleton-shimmer landing-skeleton-author" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BookCarousel books={previewBooks} />
          )}
        </section>
      )}
    </div>
  );
}

export default LandingPage;
