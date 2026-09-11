const libraryItems = [
  { name: "Colossians", description: "The supremacy of Christ and life in Him", href: "https://colossians.mybibleexplorer.com/", category: "book" },
  { name: "Corinthians", description: "Unity, worship, holy living, and resurrection", href: "https://corinthians.mybibleexplorer.com/", category: "book" },
  { name: "Daniel", description: "Prophecy and providence", href: "https://daniel.mybibleexplorer.com", category: "book" },
  { name: "Ephesians", description: "Grace, unity, new life, and spiritual warfare", href: "https://ephesians.mybibleexplorer.com/", category: "book" },
  { name: "Galatians", description: "Freedom in Christ and life by the Spirit", href: "https://galatians.mybibleexplorer.com/", category: "book" },
  { name: "Hebrews", description: "Christ, covenant, sanctuary, and persevering faith", href: "https://hebrews.mybibleexplorer.com/", category: "book" },
  { name: "Isaiah", description: "Judgment, comfort, and gospel hope", href: "https://isaiah.mybibleexplorer.com/", category: "book" },
  { name: "James", description: "Living faith, wisdom, speech, patience, and prayer", href: "https://james.mybibleexplorer.com/", category: "book" },
  { name: "Philippians", description: "Joy, humility, perseverance, and contentment", href: "https://philippians.mybibleexplorer.com/", category: "book" },
  { name: "Psalms", description: "Worship, lament, praise, and prayer", href: "https://psalms.mybibleexplorer.com", category: "book" },
  { name: "Revelation", description: "Symbols, judgment, and final hope", href: "https://revelation.mybibleexplorer.com/", category: "book" },
  { name: "Romans", description: "Righteousness by faith and life in the Spirit", href: "https://romans.mybibleexplorer.com", category: "book" },
  { name: "Hermeneutics", description: "Learn to read Scripture faithfully", href: "https://hermeneutics.mybibleexplorer.com", category: "topic" },
  { name: "Last Day Events", description: "Earth's final chapter", href: "https://lastdayevents.mybibleexplorer.com/index.html", category: "topic" },
  { name: "Life of Christ", description: "The life and ministry of Jesus", href: "https://christ.mybibleexplorer.com/", category: "topic" },
  { name: "Parables", description: "Stories of the kingdom", href: "https://parables.mybibleexplorer.com", category: "topic" },
  { name: "Salvation", description: "Righteousness by faith, justification, and assurance", href: "/", category: "topic", current: true },
  { name: "Sanctuary", description: "A blueprint of salvation", href: "https://sanctuary.mybibleexplorer.com/#structure", category: "topic" },
] as const;

export function GlobalShell() {
  return (
    <header className="mbe-global-shell" data-tool="salvation" data-embedded="true">
      <div className="mbe-shell-wrap">
        <div className="mbe-ribbon-left">
          <a className="mbe-ribbon-brand" href="https://mybibleexplorer.com" aria-label="My Bible Explorer home">
            <img className="mbe-ribbon-logo" src="/assets/my-bible-explorer-logo.png" alt="My Bible Explorer" width={107} height={34}/>
          </a>
          <a className="mbe-ribbon-back" href="https://mybibleexplorer.com/#journeys">
            Back to Library
          </a>
        </div>
        <nav className="mbe-global-nav" aria-label="My Bible Explorer">
          <details className="mbe-library-menu">
            <summary className="mbe-library-toggle">Library</summary>
            <div className="mbe-library-panel">
              <div className="mbe-library-groups">
                <section className="mbe-library-group" aria-labelledby="mbe-books-heading">
                  <p className="mbe-library-heading" id="mbe-books-heading">Books of the Bible</p>
                  <div className="mbe-library-grid mbe-library-grid-books">
                    {libraryItems.filter((item) => item.category === "book").map((item) => (
                      <a key={item.name} className="mbe-library-item" href={item.href} aria-current={"current" in item && item.current ? "page" : undefined}>
                        <span className="mbe-library-name">{item.name}</span>
                      </a>
                    ))}
                  </div>
                </section>
                <section className="mbe-library-group" aria-labelledby="mbe-topics-heading">
                  <p className="mbe-library-heading" id="mbe-topics-heading">Topics</p>
                  <div className="mbe-library-grid mbe-library-grid-topics">
                    {libraryItems.filter((item) => item.category === "topic").map((item) => (
                      <a key={item.name} className="mbe-library-item" href={item.href} aria-current={"current" in item && item.current ? "page" : undefined}>
                        <span className="mbe-library-name">{item.name}</span>
                      </a>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </details>
          <a className="mbe-ribbon-give" href="https://mybibleexplorer.com/#donate">
            Support
          </a>
        </nav>
      </div>
    </header>
  );
}

export function GlobalFooter() {
  return (
    <footer className="mbe-global-footer" data-tool="salvation">
      <div className="mbe-shell-wrap mbe-footer-wrap">
        <a className="mbe-footer-brand" href="https://mybibleexplorer.com" aria-label="My Bible Explorer home">
          <img className="mbe-footer-logo" src="/assets/my-bible-explorer-logo.png" alt="My Bible Explorer" width={107} height={34}/>
        </a>
        <span>Know the Word. Live the Word.</span>
        <span>
          To contact, email <a className="mbe-footer-link" href="mailto:admin@mybibleexplorer.com">admin@mybibleexplorer.com</a>
        </span>
        <a className="mbe-footer-link" href="https://mybibleexplorer.com/#donate">Support</a>
        <span>&copy; {new Date().getFullYear()} My Bible Explorer</span>
      </div>
    </footer>
  );
}
