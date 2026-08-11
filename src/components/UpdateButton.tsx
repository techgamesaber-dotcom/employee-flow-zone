import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addWorkspaceItem, deleteWorkspaceItem, getMcqExams, getWorkspaceItems, saveMcqExam, updateWorkspaceItem } from "@/lib/workspace.functions";
import { readSession } from "@/lib/session";

const spacesByCompany: Record<string, string[]> = {
  "section-a-origami": ["Origami Studio", "Creation Gallery", "Folding Challenges", "Paper & Materials", "Custom Requests", "Workshops"],
  "world-of-tech": ["App Idea Lab", "Build Board", "UI/UX Studio", "Testing Lab", "Bug Hunt", "Launch Center"],
  "world-of-designing": ["Interior Studio", "Room Planner", "Moodboards", "Client Projects", "Company Planner", "Strategy Board"],
  "world-of-colours": ["Art Studio", "Sketchbook", "Painting Projects", "Artwork Gallery", "Creative Challenges", "Portfolio"],
};
const icons = ["✨", "🚀", "🎯", "🧩", "🔥", "💡"];
type Content = { type?: "text" | "image" | "video"; text?: string; url?: string; x?: number; y?: number; w?: number; h?: number };
type Item = { id: string; space_key: string; title: string; description: string | null; content?: Content | null; created_at?: string };
type ExamQuestion = { question: string; options: string[]; answer: number; marks: number };

function embed(url: string) { try { const u = new URL(url); if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`; if (u.hostname.includes("youtube.com")) { if (u.pathname === "/watch") return `https://www.youtube.com/embed/${u.searchParams.get("v")}`; if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`; if (u.pathname.startsWith("/embed/")) return url; } } catch {} return url; }

export function UpdateButton() {
  const qc = useQueryClient();
  const [session, setSession] = useState(() => readSession());
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"spaces" | "mcq">("spaces");
  const [open, setOpen] = useState(false);
  const [spaceKey, setSpaceKey] = useState("space-1");
  const [editor, setEditor] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockType, setBlockType] = useState<Content["type"]>("text");
  const [blockText, setBlockText] = useState("");
  const [blockUrl, setBlockUrl] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([{ question: "", options: ["", "", "", ""], answer: 0, marks: 1 }]);

  useEffect(() => setSession(readSession()), [open]);
  const company = session?.companies.find((c) => c.id === session.activeCompanyId) ?? session?.companies[0];
  const companyId = company?.id ?? "";
  const spaceNames = spacesByCompany[company?.slug ?? ""] ?? [];
  const items = useQuery({ queryKey: ["workspace", session?.code, companyId], enabled: open && !!session?.code && !!companyId, queryFn: () => getWorkspaceItems({ data: { code: session!.code, companyId } }) });
  const exams = useQuery({ queryKey: ["mcq", session?.code, companyId], enabled: open && mode === "mcq" && !!session?.code && !!companyId, queryFn: () => getMcqExams({ data: { code: session!.code, companyId } }) });
  const allItems = (items.data ?? []) as Item[];
  const currentItems = useMemo(() => allItems.filter((x) => x.space_key === spaceKey), [allItems, spaceKey]);

  const save = useMutation({ mutationFn: (item: { id: string; title: string; content: Content }) => updateWorkspaceItem({ data: { code: session!.code, companyId, id: item.id, title: item.title, description: item.content.text ?? "", content: item.content } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }), onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save") });
  const add = useMutation({ mutationFn: () => addWorkspaceItem({ data: { code: session!.code, companyId, spaceKey, title: blockType === "image" ? "Image" : blockType === "video" ? "Video" : "Text", description: blockText, content: { type: blockType, text: blockText, url: blockUrl, x: 60 + currentItems.length * 20, y: 60 + currentItems.length * 20, w: blockType === "text" ? 300 : 420, h: blockType === "text" ? 100 : 250 } } }), onSuccess: () => { setBlockText(""); setBlockUrl(""); toast.success("Block added"); qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add block") });
  const remove = useMutation({ mutationFn: (id: string) => deleteWorkspaceItem({ data: { code: session!.code, companyId, id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", session?.code, companyId] }) });
  const saveExam = useMutation({ mutationFn: () => saveMcqExam({ data: { code: session!.code, companyId, title: examTitle, description: examDescription, questions } }), onSuccess: () => { setExamTitle(""); setExamDescription(""); setQuestions([{ question: "", options: ["", "", "", ""], answer: 0, marks: 1 }]); toast.success("MCQ exam created"); qc.invalidateQueries({ queryKey: ["mcq", session?.code, companyId] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create exam") });

  function moveItem(item: Item, clientX: number, clientY: number) {
    const el = document.querySelector(`[data-block-id="${item.id}"]`) as HTMLElement | null; const canvas = el?.parentElement; if (!canvas) return;
    const r = canvas.getBoundingClientRect(); const c = item.content ?? {}; const x = Math.max(0, Math.min(1100, clientX - r.left - (c.w ?? 300) / 2)); const y = Math.max(0, Math.min(650, clientY - r.top - 25));
    save.mutate({ id: item.id, title: item.title, content: { ...c, x, y } });
  }

  async function handleUpdate() { if (busy) return; setBusy(true); toast.success("Loading newest version…"); try { await qc.invalidateQueries(); if ("serviceWorker" in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister())); if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k))); } catch {} const u = new URL(window.location.href); u.searchParams.set("v", Date.now().toString()); u.searchParams.set("updated", "1"); window.location.replace(u.toString()); }

  useEffect(() => { const u = new URL(window.location.href); if (u.searchParams.get("updated") === "1") { u.searchParams.delete("updated"); window.history.replaceState({}, "", u.toString()); setOpen(true); } }, []);
  useEffect(() => { const onClick = (e: MouseEvent) => { const b = (e.target as HTMLElement | null)?.closest("button"); if (!b || b.closest("[data-workspace-modal]")) return; const t = b.textContent?.replace(/\s+/g, " ").trim() ?? ""; const i = spaceNames.findIndex((n) => t.includes(n)); if (i >= 0) { e.preventDefault(); e.stopPropagation(); setSpaceKey(`space-${i + 1}`); setMode("spaces"); setEditor(false); setOpen(true); } }; document.addEventListener("click", onClick, true); return () => document.removeEventListener("click", onClick, true); }, [spaceNames]);

  function addQuestion() { setQuestions((q) => [...q, { question: "", options: ["", "", "", ""], answer: 0, marks: 1 }]); }
  function updateQuestion(i: number, patch: Partial<ExamQuestion>) { setQuestions((q) => q.map((x, n) => n === i ? { ...x, ...patch } : x)); }
  function updateOption(i: number, oi: number, value: string) { setQuestions((q) => q.map((x, n) => n === i ? { ...x, options: x.options.map((o, j) => j === oi ? value : o) } : x)); }

  return <>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => { setMode("spaces"); setOpen(true); }} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold">✨ Spaces</button>
      <button onClick={() => { setMode("mcq"); setOpen(true); }} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold">📝 MCQ Exams</button>
      <button onClick={handleUpdate} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "Updating…" : "🔄 Update app"}</button>
    </div>

    {open && <div data-workspace-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border-2 border-border bg-card shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div><p className="text-xs font-black uppercase text-primary">{company?.emoji} {company?.name}</p><h2 className="text-2xl font-black">{mode === "spaces" ? spaceNames[Number(spaceKey.split("-")[1]) - 1] : "📝 MCQ Exams"}</h2></div><div className="flex gap-2"><button onClick={() => setOpen(false)} className="rounded-xl border-2 border-border px-3 py-2 font-bold">✕</button></div></header>

        {mode === "spaces" && <div className="grid min-h-[620px] md:grid-cols-[210px_1fr]">
          <aside className="border-r border-border bg-secondary/50 p-3"><p className="mb-2 text-xs font-black uppercase text-muted-foreground">Spaces</p>{spaceNames.map((n, i) => <button key={n} onClick={() => setSpaceKey(`space-${i + 1}`)} className={`mb-2 w-full rounded-xl p-3 text-left font-extrabold ${spaceKey === `space-${i + 1}` ? "bg-primary text-primary-foreground" : "bg-card"}`}>{icons[i]} {n}</button>)}{session?.isAdmin && <button onClick={() => setEditor(!editor)} className="mt-2 w-full rounded-xl bg-foreground px-3 py-3 font-extrabold text-background">{editor ? "👁 Worker View" : "✏️ Edit Space"}</button>}</aside>
          <main className="overflow-auto p-4">
            {editor && session?.isAdmin && <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-primary/20 bg-secondary p-3"><div><label className="text-xs font-black">Add</label><select value={blockType} onChange={(e) => setBlockType(e.target.value as Content["type"])} className="block rounded-xl border-2 border-border bg-card px-3 py-2 font-bold"><option value="text">Text box</option><option value="image">Image</option><option value="video">YouTube video</option></select></div>{blockType === "text" && <input value={blockText} onChange={(e) => setBlockText(e.target.value)} placeholder="Text" className="rounded-xl border-2 border-border bg-card px-3 py-2" />}{blockType !== "text" && <input value={blockUrl} onChange={(e) => setBlockUrl(e.target.value)} placeholder={blockType === "image" ? "Image URL" : "YouTube URL"} className="min-w-[260px] rounded-xl border-2 border-border bg-card px-3 py-2" />}{blockType !== "image" && blockType !== "video" && <span className="text-xs font-semibold text-muted-foreground">Drag blocks anywhere on the canvas.</span>}<button onClick={() => add.mutate()} disabled={add.isPending || (blockType === "text" ? !blockText.trim() : !blockUrl.trim())} className="rounded-xl bg-primary px-4 py-2 font-extrabold text-primary-foreground">＋ Add</button></div>}
            <div className="relative min-h-[650px] min-w-[900px] overflow-hidden rounded-2xl border-2 border-dashed border-border bg-background" onMouseMove={(e) => { if (dragId) { const item = currentItems.find((x) => x.id === dragId); if (item) moveItem(item, e.clientX, e.clientY); } }} onMouseUp={() => setDragId(null)}>
              {currentItems.map((item) => { const c = item.content ?? {}; const x = c.x ?? 30; const y = c.y ?? 30; const w = c.w ?? 300; const h = c.h ?? 100; const selected = selectedId === item.id; return <div key={item.id} data-block-id={item.id} onMouseDown={(e) => { if (editor && session?.isAdmin) { e.preventDefault(); setDragId(item.id); setSelectedId(item.id); } }} style={{ left: x, top: y, width: w, minHeight: h }} className={`absolute rounded-2xl border-2 bg-card p-3 shadow-sm ${selected ? "border-primary" : "border-border"}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="font-black">{item.title}</span>{editor && session?.isAdmin && <button onClick={(e) => { e.stopPropagation(); remove.mutate(item.id); }} className="rounded-lg border px-2 py-1 text-xs font-bold">Delete</button>}</div>{c.type === "image" && c.url && <img src={c.url} alt={item.title} className="max-h-[360px] w-full rounded-xl object-contain" />}{c.type === "video" && c.url && <iframe src={embed(c.url)} title={item.title} className="aspect-video w-full rounded-xl" allowFullScreen />}{c.type === "text" && <p className="whitespace-pre-wrap text-sm font-semibold">{c.text || item.description}</p>}{!c.type && <p className="text-sm font-semibold">{item.description}</p>}</div> })}
              {!currentItems.length && <div className="absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-3xl">🧩</p><p className="font-black">Empty space</p><p className="text-sm text-muted-foreground">Turn on Edit Space to place text, images and videos anywhere.</p></div></div>}
            </div>
            {editor && session?.isAdmin && <p className="mt-2 text-xs font-semibold text-muted-foreground">Tip: drag a block to position it anywhere on the workspace. Workers see the saved layout.</p>}
          </main>
        </div>}

        {mode === "mcq" && <div className="max-h-[75vh] overflow-y-auto p-5">
          {session?.isAdmin && <form onSubmit={(e) => { e.preventDefault(); if (!examTitle.trim()) return; saveExam.mutate(); }} className="mb-6 rounded-2xl border-2 border-primary/20 bg-secondary p-4"><h3 className="text-xl font-black">Create MCQ exam</h3><div className="mt-3 grid gap-3"><input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="Exam title" className="rounded-xl border-2 border-border bg-card px-3 py-3 font-bold" /><input value={examDescription} onChange={(e) => setExamDescription(e.target.value)} placeholder="Instructions / description" className="rounded-xl border-2 border-border bg-card px-3 py-3" />{questions.map((q, i) => <div key={i} className="rounded-xl border border-border bg-card p-4"><div className="mb-2 flex justify-between"><b>Question {i + 1}</b><label className="text-sm">Marks <input type="number" min="1" value={q.marks} onChange={(e) => updateQuestion(i, { marks: Number(e.target.value) })} className="ml-1 w-16 rounded border px-2 py-1" /></label></div><input value={q.question} onChange={(e) => updateQuestion(i, { question: e.target.value })} placeholder="Type the question" className="mb-2 w-full rounded-lg border px-3 py-2" />{q.options.map((o, oi) => <div key={oi} className="mb-2 flex gap-2"><input type="radio" checked={q.answer === oi} onChange={() => updateQuestion(i, { answer: oi })} /><input value={o} onChange={(e) => updateOption(i, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 rounded-lg border px-3 py-2" /></div>)}</div>)}<div className="flex gap-2"><button type="button" onClick={addQuestion} className="rounded-xl border-2 border-border px-4 py-2 font-extrabold">＋ Question</button><button disabled={saveExam.isPending} className="rounded-xl bg-primary px-4 py-2 font-extrabold text-primary-foreground">{saveExam.isPending ? "Saving…" : "Publish Exam"}</button></div></div></form>}
          <h3 className="mb-3 text-xl font-black">Available exams</h3>{(exams.data ?? []).length === 0 ? <p className="rounded-xl border p-4 text-sm font-semibold text-muted-foreground">No exams published yet.</p> : <div className="grid gap-3 md:grid-cols-2">{(exams.data as any[]).map((e) => <div key={e.id} className="rounded-2xl border-2 border-border p-4"><p className="font-black">{e.title}</p><p className="text-sm font-semibold text-muted-foreground">{e.description}</p><p className="mt-2 text-xs font-bold">{Array.isArray(e.questions) ? e.questions.length : 0} questions</p></div>)}</div>}
        </div>}
      </section>
    </div>}
  </>;
}
