import { useEffect, useState } from "react";
import "./App.css";
import { fetchMatchSummary, type MatchSummary } from "./api";
import { DATA_SOURCE_URL, MATCH_TITLE } from "./match";
import MatchAnalysisPage, {
  type ClipSettings,
} from "./pages/MatchAnalysisPage";
import OverviewPage from "./pages/OverviewPage";
import PlayersPage from "./pages/PlayersPage";

type Page = "overview" | "analysis" | "players";

const PAGES: { id: Page; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "Match Analysis" },
  { id: "players", label: "Players" },
];

// The page lives in the URL hash so links and the back button work
function readPage(): Page {
  const hash = window.location.hash.replace("#", "");
  return PAGES.some((page) => page.id === hash)
    ? (hash as Page)
    : "overview";
}

function App() {
  // Match metadata and player statistics from FastAPI
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState<Page>(readPage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipSettings, setClipSettings] = useState<ClipSettings>({
    period: 1,
    start: 0,
    length: 60,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetchMatchSummary(controller.signal)
      .then(setSummary)
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("Could not connect to the PitchIQ backend.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onHashChange = () => setPage(readPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(next: Page) {
    window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0 });
  }

  function openProfile(id: string) {
    setSelectedId(id);
    navigate("players");
  }

  // Jump the replay to a window where the player is actually on the pitch
  function watchPlayer(id: string) {
    const player = summary?.players.find((p) => p.id === id);
    const periodInfo = summary?.periods.find(
      (p) => p.period === clipSettings.period
    );

    if (player && periodInfo && player.first_seen_time !== null) {
      const clipFrom = periodInfo.start_time + clipSettings.start;
      const clipTo = clipFrom + clipSettings.length;
      const visible =
        player.first_seen_time < clipTo &&
        (player.last_seen_time ?? 0) > clipFrom;

      if (!visible && player.first_seen_period !== null) {
        const entryPeriod = summary?.periods.find(
          (p) => p.period === player.first_seen_period
        );
        const offset =
          player.first_seen_time - (entryPeriod?.start_time ?? 0);

        setClipSettings({
          ...clipSettings,
          period: player.first_seen_period,
          start: Math.floor(offset / 60) * 60,
        });
      }
    }

    setSelectedId(id);
    navigate("analysis");
  }

  let content;

  if (error) {
    content = (
      <div className="panel notice">
        <h2>Connection Error</h2>
        <p>{error}</p>
        <p>Make sure your FastAPI server is running on port 8000.</p>
      </div>
    );
  } else if (!summary) {
    content = (
      <div className="panel notice">
        <h2>Loading match data</h2>
        <p>
          Reading the home and away tracking files for {MATCH_TITLE}…
        </p>
      </div>
    );
  } else if (page === "analysis") {
    content = (
      <MatchAnalysisPage
        summary={summary}
        clipSettings={clipSettings}
        onClipChange={setClipSettings}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpenProfile={openProfile}
      />
    );
  } else if (page === "players") {
    content = (
      <PlayersPage
        summary={summary}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onWatch={watchPlayer}
      />
    );
  } else {
    content = (
      <OverviewPage
        summary={summary}
        selectedId={selectedId}
        onOpenProfile={openProfile}
        onOpenReplay={() => navigate("analysis")}
      />
    );
  }

  const pageLabel = PAGES.find((p) => p.id === page)?.label;

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <span>PitchIQ</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav className="navigation">
          {PAGES.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav-item${item.id === page ? " active" : ""}`}
              aria-current={item.id === page ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-dataset">
          <span className="sidebar-dataset-label">Dataset</span>
          <strong>Sample Game 1</strong>
          <span>Anonymized tracking data</span>
          <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer">
            Metrica Sports ↗
          </a>
        </div>

        <div className="sidebar-bottom">
          <span className={`status-dot${summary ? "" : " offline"}`}></span>
          {summary ? "Backend connected" : "Connecting to backend"}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span>PitchIQ</span>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <strong>{pageLabel}</strong>
          </nav>

          <div className="topbar-match">
            <span className="topbar-match-title">{MATCH_TITLE}</span>
            <span className="anonymized-tag">Anonymized match</span>
          </div>
        </header>

        {/* Mobile navigation, shown only when the sidebar is hidden */}
        <nav className="mobile-nav" aria-label="Sections">
          {PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === page ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="content">
          {content}

          {/* FOOTER */}
          <div className="footer-note">
            <span>
              PitchIQ — Football Tracking & Performance Analysis
            </span>

            <span>
              Tracking data:{" "}
              <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer">
                Metrica Sports Sample Game 1
              </a>
              {" · Development prototype"}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
