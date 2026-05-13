import { useState, useEffect, useRef } from "react";

const DOC_TYPES = [
  { id: "license", label: "Contractor License" },
  { id: "coi", label: "Insurance (COI)" },
  { id: "osha", label: "OSHA Certification" },
  { id: "safety", label: "Safety Cert" },
];

const STORAGE_KEY = "gc_compliance_v1";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusFor(doc) {
  if (!doc || !doc.expiry) return "missing";
  const d = daysUntil(doc.expiry);
  if (d < 0) return "expired";
  if (d <= 30) return "soon";
  return "ok";
}

function overallStatus(sub) {
  const statuses = DOC_TYPES.map(t => statusFor(sub.docs?.[t.id]));
  if (statuses.includes("expired") || statuses.includes("missing")) return "red";
  if (statuses.includes("soon")) return "amber";
  return "green";
}

const STATUS_COLORS = {
  ok: { bg: "#eaf3de", text: "#3b6d11", label: "Valid" },
  soon: { bg: "#faeeda", text: "#854f0b", label: "Expiring" },
  expired: { bg: "#fcebeb", text: "#a32d2d", label: "Expired" },
  missing: { bg: "#f1efe8", text: "#5f5e5a", label: "Missing" },
};

const OVERALL_COLORS = {
  green: { bg: "#eaf3de", text: "#3b6d11", dot: "#63991a" },
  amber: { bg: "#faeeda", text: "#854f0b", dot: "#ba7517" },
  red: { bg: "#fcebeb", text: "#a32d2d", dot: "#e24b4a" },
};

function Badge({ status }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

function initSubs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSubs(subs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(subs)); } catch {}
}

export default function App() {
  const [subs, setSubs] = useState(initSubs);
  const [view, setView] = useState("dashboard"); // dashboard | detail | add
  const [selectedId, setSelectedId] = useState(null);
  const [addName, setAddName] = useState("");
  const [addTrade, setAddTrade] = useState("");
  const [editDoc, setEditDoc] = useState(null); // { subId, typeId }
  const [docForm, setDocForm] = useState({ number: "", expiry: "", fileName: "" });
  const fileRef = useRef();

  useEffect(() => { saveSubs(subs); }, [subs]);

  const selectedSub = subs.find(s => s.id === selectedId);

  function addSub() {
    if (!addName.trim()) return;
    const s = { id: Date.now().toString(), name: addName.trim(), trade: addTrade.trim(), docs: {} };
    setSubs(prev => [...prev, s]);
    setAddName(""); setAddTrade("");
    setSelectedId(s.id);
    setView("detail");
  }

  function deleteSub(id) {
    setSubs(prev => prev.filter(s => s.id !== id));
    setView("dashboard");
  }

  function openDocEdit(subId, typeId) {
    const sub = subs.find(s => s.id === subId);
    const existing = sub?.docs?.[typeId] || {};
    setDocForm({ number: existing.number || "", expiry: existing.expiry || "", fileName: existing.fileName || "" });
    setEditDoc({ subId, typeId });
  }

  function saveDoc() {
    setSubs(prev => prev.map(s => {
      if (s.id !== editDoc.subId) return s;
      return { ...s, docs: { ...s.docs, [editDoc.typeId]: { ...docForm } } };
    }));
    setEditDoc(null);
  }

  function removeDoc(subId, typeId) {
    setSubs(prev => prev.map(s => {
      if (s.id !== subId) return s;
      const docs = { ...s.docs };
      delete docs[typeId];
      return { ...s, docs };
    }));
    setEditDoc(null);
  }

  const counts = { total: subs.length, green: 0, amber: 0, red: 0 };
  subs.forEach(s => { const o = overallStatus(s); counts[o]++; });

  // Dashboard
  if (view === "dashboard") return (
    <div style={{ padding: "1.5rem 1.25rem", fontFamily: "var(--font-sans)", maxWidth: 680 }}>
      <h2 className="sr-only">GC Compliance Tracker dashboard</h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>Compliance Tracker</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{counts.total} subcontractors</div>
        </div>
        <button onClick={() => setView("add")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 16 }} /> Add sub
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" }}>
        {[["green","Compliant"],["amber","Expiring soon"],["red","Action needed"]].map(([k,label]) => (
          <div key={k} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.75rem 1rem" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: OVERALL_COLORS[k].text }}>{counts[k]}</div>
          </div>
        ))}
      </div>

      {/* Sub list */}
      {subs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
          No subcontractors yet. Add your first one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subs.map(sub => {
            const ov = overallStatus(sub);
            const oc = OVERALL_COLORS[ov];
            return (
              <div key={sub.id} onClick={() => { setSelectedId(sub.id); setView("detail"); }}
                style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "0.875rem 1.125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: oc.dot, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>{sub.name}</div>
                  {sub.trade && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 1 }}>{sub.trade}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {DOC_TYPES.map(t => {
                    const st = statusFor(sub.docs?.[t.id]);
                    const c = STATUS_COLORS[st];
                    return <div key={t.id} title={t.label} style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.text}33` }} />;
                  })}
                </div>
                <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 16, color: "var(--color-text-tertiary)" }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: "1.25rem", fontSize: 11, color: "var(--color-text-secondary)" }}>
        {Object.entries(STATUS_COLORS).map(([k,v]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: v.bg, border: `1px solid ${v.text}55`, display:"inline-block" }} />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );

  // Add sub
  if (view === "add") return (
    <div style={{ padding: "1.5rem 1.25rem", fontFamily: "var(--font-sans)", maxWidth: 480 }}>
      <button onClick={() => setView("dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
        <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 15 }} /> Back
      </button>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: "1.25rem", color: "var(--color-text-primary)" }}>Add subcontractor</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Company name *</label>
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Apex Electrical" style={{ width: "100%", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && addSub()} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Trade / specialty</label>
          <input value={addTrade} onChange={e => setAddTrade(e.target.value)} placeholder="e.g. Electrical, Plumbing, HVAC" style={{ width: "100%", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && addSub()} />
        </div>
        <button onClick={addSub} style={{ marginTop: 4, cursor: "pointer" }}>Add subcontractor</button>
      </div>
    </div>
  );

  // Detail view
  if (view === "detail" && selectedSub) return (
    <div style={{ padding: "1.5rem 1.25rem", fontFamily: "var(--font-sans)", maxWidth: 680 }}>
      <button onClick={() => setView("dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
        <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 15 }} /> All subs
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>{selectedSub.name}</div>
          {selectedSub.trade && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{selectedSub.trade}</div>}
        </div>
        <button onClick={() => { if (confirm(`Remove ${selectedSub.name}?`)) deleteSub(selectedSub.id); }} style={{ fontSize: 12, color: "var(--color-text-danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 14 }} /> Remove
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {DOC_TYPES.map(t => {
          const doc = selectedSub.docs?.[t.id];
          const st = statusFor(doc);
          const c = STATUS_COLORS[st];
          const days = doc?.expiry ? daysUntil(doc.expiry) : null;
          return (
            <div key={t.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "0.875rem 1.125rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: doc ? 8 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{t.label}</span>
                  <Badge status={st} />
                </div>
                <button onClick={() => openDocEdit(selectedSub.id, t.id)} style={{ fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--color-text-secondary)" }}>
                  <i className={`ti ti-${doc ? "edit" : "plus"}`} aria-hidden="true" style={{ fontSize: 14 }} />
                  {doc ? "Edit" : "Add"}
                </button>
              </div>
              {doc && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {doc.number && (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Number / ID</div>
                      <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginTop: 2 }}>{doc.number}</div>
                    </div>
                  )}
                  {doc.expiry && (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Expires</div>
                      <div style={{ fontSize: 13, color: c.text, marginTop: 2 }}>
                        {new Date(doc.expiry).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                        {days !== null && <span style={{ marginLeft: 6, fontSize: 11 }}>({days >= 0 ? `${days}d left` : `${Math.abs(days)}d ago`})</span>}
                      </div>
                    </div>
                  )}
                  {doc.fileName && (
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>File</div>
                      <div style={{ fontSize: 13, color: "var(--color-text-info)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <i className="ti ti-file" aria-hidden="true" style={{ fontSize: 14 }} />{doc.fileName}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Doc edit modal (inline faux modal) */}
      {editDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setEditDoc(null); }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", padding: "1.5rem", width: 340, boxSizing: "border-box" }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: "1rem", color: "var(--color-text-primary)" }}>
              {DOC_TYPES.find(t => t.id === editDoc.typeId)?.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>License / cert number</label>
                <input value={docForm.number} onChange={e => setDocForm(f => ({...f, number: e.target.value}))} placeholder="e.g. LIC-20481" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Expiration date</label>
                <input type="date" value={docForm.expiry} onChange={e => setDocForm(f => ({...f, expiry: e.target.value}))} style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Upload document</label>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ fontSize: 13, width: "100%" }}
                  onChange={e => { if (e.target.files[0]) setDocForm(f => ({...f, fileName: e.target.files[0].name})); }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
              <button onClick={saveDoc} style={{ flex: 1, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditDoc(null)} style={{ cursor: "pointer" }}>Cancel</button>
              {selectedSub?.docs?.[editDoc.typeId] && (
                <button onClick={() => removeDoc(editDoc.subId, editDoc.typeId)} style={{ cursor: "pointer", color: "var(--color-text-danger)", fontSize: 13 }}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}
