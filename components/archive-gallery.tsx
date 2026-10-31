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

// Turn camera photos into small, safe JPEGs before sending them to the server.
async function preparePhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image."));
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Could not read that image.");
    let scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser couldn't prepare that image.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", Math.max(0.48, 0.82 - attempt * 0.08)));
      if (blob && blob.size <= 3 * 1024 * 1024) return blob;
      scale *= 0.78;
    }
    throw new Error("Could not make this image small enough. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  const [source, setSource] = useState<"link" | "file">("link");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
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
        setHasMore(data.hasMore);
        setOffset(data.nextOffset);
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

  async function loadMore() {
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/images?offset=${offset}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load more images.");
      setMemes((current) => [...current, ...data.images.filter((image: Meme) => !current.some((item) => item.id === image.id))]);
      setOffset(data.nextOffset);
      setHasMore(data.hasMore);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load more images.");
    } finally { setLoadingMore(false); }
  }

  function chooseColor(value: string) {
    setColor(value);
    try { localStorage.setItem("avci-color", value); } catch { /* Available for this visit only. */ }
  }

  async function addImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (source === "file") {
        if (!file) throw new Error("Choose an image from your device.");
        const processed = await preparePhoto(file);
        const upload = new FormData();
        upload.append("file", processed, "image.jpg");
        upload.append("title", form.title);
        upload.append("description", form.description);
        body = upload;
      } else {
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify(form);
      }
      const response = await fetch("/api/images", {
        method: "POST",
        headers,
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this image.");
      setMemes((current) => [data.image, ...current]);
      setOffset((current) => current + 1);
      setForm({ image: "", title: "", description: "" });
      setFile(null);
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
            <span className="brand-mark">a.</span> avci<span className="brand-light"> collections</span>
          </a>
          <div className="nav-actions">
            <button type="button" className="settings-trigger" onClick={() => setPanel("settings")} aria-label="Color settings"><span aria-hidden="true">◐</span> <span>Colors</span></button>
            <button type="button" className="add-trigger" onClick={() => { setError(""); setPanel("add"); }}><span aria-hidden="true">＋</span> Add image</button>
          </div>
        </nav>

        <header className="cover">
          <div className="cover-left">
            <div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE CORNER OF THE INTERNET</div>
            <h1>For things<br />you <span>like.</span></h1>
            <div className="cover-caption">
              <p>That picture you saved. The meme you sent everyone. Keep them together, right here.</p>
              <div className="hero-actions"><a className="jump-link" href="#gallery">Browse the collection <span aria-hidden="true">↘</span></a><button type="button" className="hero-add" onClick={() => setPanel("add")}>Add a picture <span aria-hidden="true">＋</span></button></div>
            </div>
          </div>
          <div className="cover-composition">
            <div className="collection-card">
              <div className="collection-card-top"><span>YOUR COLLECTION</span><span>✳</span></div>
              <div className="collection-art" aria-hidden="true"><span className="art-fold" /><span className="art-circle" /><span className="art-cross">✳</span></div>
              <div className="collection-card-bottom"><div><strong>A place for your finds.</strong><span>Pictures, memes, whatever you like.</span></div><a href="#gallery" aria-label="Browse the collection">↗</a></div>
            </div>
          </div>
          <div className="cover-bottom"><span>MADE FOR THE THINGS YOU WANT TO KEEP</span><span>SCROLL TO BROWSE <b aria-hidden="true">↓</b></span></div>
        </header>

        <section id="gallery" className="archive">
          <div className="archive-heading">
            <div>
              <div className="eyebrow">TAKE A LOOK AROUND</div>
              <h2>The <span>collection.</span></h2>
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the collection" aria-label="Search memes by title or creator" />
              <kbd>/</kbd>
            </label>
          </div>
          <div className="archive-bar">
            <span className="filter-chip active">Everything</span>
            <span className="results-count"><strong>{visibleMemes.length}</strong> {visibleMemes.length === 1 ? "image" : "images"} <span>{hasMore ? "loaded" : "in the collection"}</span></span>
          </div>
          {loading ? <div className="empty-state">Loading the collection…</div> : loadError && memes.length === 0 ? (
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
                <p>{memes.length ? "Try another search, or load more images." : "Add a picture or a link to get started."}</p>
                {search && memes.length > 0 && <button type="button" className="reset-button" onClick={() => setSearch("")}>Clear search ↗</button>}
                {!memes.length && <button type="button" className="reset-button" onClick={() => setPanel("add")}>Add your first image ↗</button>}
              </div>
              <span className="empty-number">00 / ∞</span>
            </div>
          )}
          {loadError && memes.length > 0 && <p className="panel-error" role="alert">{loadError}</p>}
          {hasMore && <div className="load-more-row"><button type="button" className="load-more-button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load more images"} <span>↓</span></button>{search && <p>Search covers the images loaded so far.</p>}</div>}
        </section>

        <footer className="footer">
          <a className="brand" href="#"><span className="brand-mark">a.</span> avci<span className="brand-light"> collections</span></a>
          <span>Made for things worth keeping.</span>
          <a href="#">Back to the top ↑</a>
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
                <p className="panel-intro">Pick a photo or paste an image link.</p>
                <form onSubmit={addImage}>
                  <div className="source-switch" aria-label="Image source">
                    <button type="button" aria-pressed={source === "link"} className={source === "link" ? "source-active" : ""} onClick={() => { setSource("link"); setError(""); }}>↗ Image link</button>
                    <button type="button" aria-pressed={source === "file"} className={source === "file" ? "source-active" : ""} onClick={() => { setSource("file"); setError(""); }}>＋ From device</button>
                  </div>
                  {source === "link" ? <label key="link" className="field-label">IMAGE LINK<input type="url" required maxLength={2048} value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://example.com/image.jpg" /></label> : <label key="file" className="field-label">CHOOSE A PHOTO<input className="file-input" type="file" required accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="file-help">JPEG, PNG, WebP or GIF. Your browser makes a smaller JPEG; GIFs become still images.</span></label>}
                  <label className="field-label">IMAGE NAME<input required maxLength={60} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Give it a name" /></label>
                  <label className="field-label">DESCRIPTION <span>(OPTIONAL)</span><textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A little backstory…" rows={3} /></label>
                  {error && <p className="panel-error" role="alert">{error}</p>}
                  <button type="submit" className="submit-entry" disabled={saving}>{saving ? "Adding…" : "Add to collection"} <span>↗</span></button>
                </form>
                <p className="panel-note">Descriptions appear when an image is opened. Uploads are public.</p>
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
