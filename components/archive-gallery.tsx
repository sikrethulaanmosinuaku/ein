"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./archive.css";

type Meme = {
  id: string | number;
  title: string;
  creator: string;
  image: string;
  description: string;
};

function MemeImage({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`image-fallback ${className}`} role="img" aria-label={`${title} image unavailable`}>
        <span aria-hidden="true">▧</span>
        <span>image wandered off</span>
      </div>
    );
  }
  return <img className={className} src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}

export function ArchiveGallery() {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Meme | null>(null);
  const [panel, setPanel] = useState<"add" | "settings" | null>(null);
  const [color, setColor] = useState("lime");
  const [form, setForm] = useState({ image: "", title: "", description: "" });
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleMemes = useMemo(() => memes.filter((meme) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = `${meme.title} ${meme.creator}`.toLowerCase().includes(term);
    return matchesSearch;
  }), [search, memes]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("avci-color");
      if (stored && ["lime", "violet", "pink", "aqua", "orange"].includes(stored)) setColor(stored);
    } catch { /* Settings still work for this visit if storage is unavailable. */ }
    const controller = new AbortController();
    fetch("/api/images", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load the collection.");
        setMemes((current) => [...current, ...data.images.filter((image: Meme) => !current.some((item) => item.id === image.id))]);
      })
      .catch((err) => { if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Could not load the collection."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !selected && !panel && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") { setSelected(null); setPanel(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, panel]);

  function chooseColor(value: string) {
    setColor(value);
    try { localStorage.setItem("avci-color", value); } catch { /* Available for this visit only. */ }
  }

  async function addImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this image.");
      setMemes((current) => [data.image, ...current]);
      setForm({ image: "", title: "", description: "" });
      setSearch("");
      setPanel(null);
      setLoadError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`site-shell palette-${color}`}>
      <div className="site-wrap">
        <nav className="topbar">
          <a className="brand" href="#" aria-label="Avci Collections home">
            <span className="brand-mark">A</span> AVCI<span className="brand-light">/COLLECTIONS</span>
          </a>
          <div className="nav-actions">
            <button type="button" className="settings-trigger" onClick={() => setPanel("settings")} aria-label="Color settings"><span aria-hidden="true">◐</span> <span>Colors</span></button>
            <button type="button" className="add-trigger" onClick={() => { setError(""); setPanel("add"); }}><span aria-hidden="true">＋</span> Add image</button>
          </div>
        </nav>

        <header className="cover">
          <div className="cover-left">
            <div className="eyebrow"><span className="eyebrow-dot" /> A SMALL, CURATED INTERNET</div>
            <h1>AVCI<br /><span>COLLECTIONS</span></h1>
            <div className="cover-caption">
              <p>Good jokes deserve<br />a place on the wall.</p>
              <a className="jump-link" href="#gallery">Browse the collection <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <span className="orbit-ring orbit-one" /><span className="orbit-ring orbit-two" />
            <span className="orbit-core">A<span>✳</span></span>
            <span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" />
            <span className="orbit-caption">YOUR INTERNET, COLLECTED.</span>
          </div>
          <div className="cover-bottom"><span>INTERNET CULTURE, FILED FOR LATER</span><span>COLLECTION 001 <b aria-hidden="true">✳</b></span></div>
        </header>

        <section id="gallery" className="archive">
          <div className="archive-heading">
            <div>
              <div className="eyebrow">THE GOOD STUFF, ALL TOGETHER</div>
              <h2>Scroll <span>responsibly.</span></h2>
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the collection" aria-label="Search memes by title or creator" />
              <kbd>/</kbd>
            </label>
          </div>
          <div className="archive-bar">
            <span className="filter-chip active">Everything</span>
            <span className="results-count"><strong>{visibleMemes.length}</strong> {visibleMemes.length === 1 ? "piece" : "pieces"} <span>in the archive</span></span>
          </div>
          {loading ? <div className="empty-state">Loading the collection…</div> : loadError ? (
            <div className="empty-state empty-collection"><div><span className="empty-label">CONNECTION NEEDED</span><h3>Couldn&apos;t load the collection.</h3><p>{loadError}</p></div></div>
          ) : visibleMemes.length ? (
            <div className="meme-grid">
              {visibleMemes.map((meme, index) => (
                <button type="button" className={`meme-card ${index % 4 === 2 ? "offset-card" : ""}`} key={meme.id} onClick={() => setSelected(meme)} aria-label={`Open ${meme.title}`}>
                  <div className="meme-image-wrap">
                    <MemeImage src={meme.image} title={meme.title} className="meme-image" />
                    <span className="card-index">{String(memes.findIndex((item) => item.id === meme.id) + 1).padStart(2, "0")} <span>/ {String(memes.length).padStart(2, "0")}</span></span>
                    <span className="card-arrow" aria-hidden="true">↗</span>
                  </div>
                  <div className="meme-meta">
                    <span className="meme-title">{meme.title}</span>
                    <span className="creator">by {meme.creator}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-collection">
              <span className="empty-mark" aria-hidden="true">✳</span>
              <div>
                <span className="empty-label">{memes.length ? "NO MATCHES. YET." : "A BLANK CANVAS"}</span>
                <h3>{memes.length ? "Nothing found." : "The collection starts here."}</h3>
                <p>{memes.length ? "Try a different search." : "Add an image link to start your collection."}</p>
                {search && memes.length > 0 && <button type="button" className="reset-button" onClick={() => setSearch("")}>Clear search ↗</button>}
                {!memes.length && <button type="button" className="reset-button" onClick={() => setPanel("add")}>Add your first image ↗</button>}
              </div>
              <span className="empty-number">00 / ∞</span>
            </div>
          )}
        </section>

        <footer className="footer">
          <a className="brand" href="#"><span className="brand-mark">A</span> AVCI<span className="brand-light">/COLLECTIONS</span></a>
          <span>Small collection. Big send-to-the-chat energy.</span>
          <a href="#gallery">Back to the archive ↑</a>
        </footer>
      </div>

      {selected && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dialog gallery-lightbox" role="dialog" aria-modal="true" aria-labelledby="meme-name">
            <button className="close-button" type="button" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <MemeImage src={selected.image} title={selected.title} className="lightbox-image" />
            <div className="lightbox-info">
              <div>
                <div className="eyebrow">AVCI COLLECTIONS / ARCHIVE</div>
                <h2 id="meme-name">{selected.title}</h2>
                {selected.description && <p className="image-description">{selected.description}</p>}
              </div>
              <span className="lightbox-number">AVCI<br />COLLECTIONS<br />№ {String(memes.findIndex((meme) => meme.id === selected.id) + 1).padStart(2, "0")}</span>
            </div>
          </section>
        </div>
      )}
      {panel && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
          <section className="dialog panel-dialog" role="dialog" aria-modal="true" aria-labelledby="panel-title">
            <button className="close-button" type="button" onClick={() => setPanel(null)} aria-label="Close">×</button>
            {panel === "add" ? (
              <>
                <div className="eyebrow">YOUR COLLECTION / NEW ENTRY</div><h2 id="panel-title">Add an image<span>.</span></h2>
                <p className="panel-intro">A great find deserves a place on the wall.</p>
                <form onSubmit={addImage}>
                  <label className="field-label">IMAGE LINK<input type="url" required maxLength={2048} value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://example.com/image.jpg" /></label>
                  <label className="field-label">IMAGE NAME<input required maxLength={60} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Give it a name" /></label>
                  <label className="field-label">DESCRIPTION <span>(OPTIONAL)</span><textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A little backstory…" rows={3} /></label>
                  {error && <p className="panel-error" role="alert">{error}</p>}
                  <button type="submit" className="submit-entry" disabled={saving}>{saving ? "Adding…" : "Add to collection"} <span>↗</span></button>
                </form>
                <p className="panel-note">Use a direct HTTPS image link. Descriptions appear when an image is opened.</p>
              </>
            ) : (
              <>
                <div className="eyebrow">MAKE IT YOURS</div><h2 id="panel-title">Pick a color<span>.</span></h2>
                <p className="panel-intro">Choose your accent. Your pick is saved in this browser.</p>
                <div className="palette-grid">
                  {[["lime", "Lime"], ["violet", "Violet"], ["pink", "Pink"], ["aqua", "Aqua"], ["orange", "Orange"]].map(([key, label]) => (
                    <button key={key} type="button" className={`palette-choice swatch-${key} ${color === key ? "is-selected" : ""}`} onClick={() => chooseColor(key)} aria-pressed={color === key}><span className="palette-dot" /><span>{label}</span>{color === key && <b>✓</b>}</button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
