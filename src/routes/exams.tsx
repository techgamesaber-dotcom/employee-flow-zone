import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteExam, getSubmission, gradeSubmission, listExams, saveExam, setExamPublished, submitExam } from "@/lib/exams.functions";
import { uploadToWorkspace } from "@/lib/upload";
import { readSession, type CompanyAccess, type Session } from "@/lib/session";
import { UpdateButton } from "@/components/UpdateButton";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "Worksy — Exams & Skill Checks" },
      { name: "description", content: "Create, publish, take and grade mixed-format exams for your team." },
      { property: "og:title", content: "Worksy — Exams & Skill Checks" },
      { property: "og:description", content: "Create, publish, take and grade mixed-format exams for your team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

type QType = "mcq" | "fill" | "written" | "match" | "photo" | "video";
type Draft = { type: QType; prompt: string; marks: number; options: string; correct: number; answer: string; pairs: string };

const TYPE_LABELS: Record<QType, string> = {
  mcq: "Multiple choice",
  fill: "Fill in the blank",
  written: "Written answer",
  match: "Match the following",
  photo: "Photo upload answer",
  video: "Video upload answer",
};

const blank = (type: QType): Draft => ({ type, prompt: "", marks: 5, options: "Option A\nOption B\nOption C", correct: 0, answer: "", pairs: "Paper | Origami\nPixel | Screen" });

function draftToPayload(d: Draft) {
  const config: Record<string, unknown> = {};
  const answerKey: Record<string, unknown> = {};
  if (d.type === "mcq") {
    config["options"] = d.options.split("\n").map((x) => x.trim()).filter(Boolean);
    answerKey["correct"] = d.correct;
  }
  if (d.type === "fill") {
    answerKey["text"] = d.answer.split(",")[0]?.trim() ?? "";
    answerKey["alternatives"] = d.answer.split(",").slice(1).map((x) => x.trim()).filter(Boolean);
  }
  if (d.type === "match") {
    config["pairs"] = d.pairs
      .split("\n")
      .map((line) => line.split("|"))
      .filter((p) => p.length === 2)
      .map((p) => ({ left: p[0]!.trim(), right: p[1]!.trim() }));
  }
  return { type: d.type, prompt: d.prompt, marks: d.marks, config, answerKey };
}

function ExamsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<CompanyAccess | null>(null);
  const [view, setView] = useState<{ mode: "list" } | { mode: "build"; examId?: string } | { mode: "take"; examId: string } | { mode: "grade"; submissionId: string }>({ mode: "list" });

  const fetchExams = useServerFn(listExams);
  const persist = useServerFn(saveExam);
  const publish = useServerFn(setExamPublished);
  const drop = useServerFn(deleteExam);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setSession(s);
    setCompany(s.companies.find((c) => c.id === s.activeCompanyId) ?? s.companies[0] ?? null);
  }, [navigate]);

  const code = session?.code ?? "";
  const companyId = company?.id ?? "";
  const exams = useQuery({ queryKey: ["exams", code, companyId], enabled: !!code && !!companyId, queryFn: () => fetchExams({ data: { code, companyId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["exams", code, companyId] });

  // Builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([blank("mcq")]);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  function startNew() {
    setTitle("");
    setDescription("");
    setDrafts([blank("mcq")]);
    setEditingId(undefined);
    setView({ mode: "build" });
  }

  function startEdit(exam: any) {
    setTitle(exam.title);
    setDescription(exam.description);
    setEditingId(exam.id);
    setDrafts(
      exam.questions.map((q: any): Draft => ({
        type: q.type,
        prompt: q.prompt,
        marks: q.marks,
        options: (q.config?.options ?? []).join("\n") || "Option A\nOption B",
        correct: Number(q.answer_key?.correct ?? 0),
        answer: [q.answer_key?.text, ...(q.answer_key?.alternatives ?? [])].filter(Boolean).join(", "),
        pairs: (q.config?.pairs ?? []).map((p: any) => `${p.left} | ${p.right}`).join("\n") || "Left | Right",
      })),
    );
    setView({ mode: "build" });
  }

  async function saveDraft() {
    if (!title.trim()) return toast.error("Give the exam a title.");
    if (drafts.some((d) => !d.prompt.trim())) return toast.error("Every question needs a prompt.");
    try {
      await persist({ data: { code, companyId, id: editingId, title, description, questions: drafts.map(draftToPayload) } });
      toast.success("Exam saved 📝");
      refresh();
      setView({ mode: "list" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the exam.");
    }
  }

  if (!session || !company) return <main className="p-8 text-center font-bold">Loading exams…</main>;
  const d = exams.data;
  const isAdmin = !!d?.isAdmin;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate({ to: session.isAdmin ? "/admin" : "/worker" })} className="text-xs font-extrabold uppercase tracking-wider text-primary hover:underline">← Back to dashboard</button>
          <h1 className="mt-1 text-3xl font-extrabold">📝 Exams & skill checks</h1>
          <p className="text-sm font-semibold text-muted-foreground">{company.emoji} {company.name}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && view.mode === "list" && <button onClick={startNew} className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground">＋ New exam</button>}
          {view.mode !== "list" && <button onClick={() => setView({ mode: "list" })} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold">← All exams</button>}
          <UpdateButton />
        </div>
      </header>

      {view.mode === "list" && (
        <section className="space-y-3">
          {exams.isLoading && <p className="font-bold text-muted-foreground">Loading…</p>}
          {!exams.isLoading && !d?.exams.length && <p className="font-bold text-muted-foreground">No exams yet.</p>}
          {(d?.exams ?? []).map((exam: any) => {
            const mine = exam.submissions.find((s: any) => s.worker_id === d!.workerId);
            return (
              <article key={exam.id} className="card-fun p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold">{exam.title}</h2>
                    <p className="text-sm font-semibold text-muted-foreground">{exam.description || "No description"}</p>
                    <p className="mt-1 text-xs font-extrabold text-primary">{exam.questionCount} questions · {exam.maxScore} marks · {exam.is_published ? "Published" : "Draft"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdmin ? (
                      <>
                        <button onClick={() => startEdit(exam)} className="rounded-xl border-2 border-border px-3 py-2 text-xs font-extrabold">✏️ Edit</button>
                        <button onClick={async () => { await publish({ data: { code, companyId, id: exam.id, published: !exam.is_published } }); refresh(); }} className="rounded-xl bg-mint px-3 py-2 text-xs font-extrabold text-mint-foreground">
                          {exam.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button onClick={async () => { if (confirm("Delete this exam?")) { await drop({ data: { code, companyId, id: exam.id } }); refresh(); } }} className="rounded-xl bg-berry px-3 py-2 text-xs font-extrabold text-berry-foreground">🗑️</button>
                      </>
                    ) : mine ? (
                      <span className="rounded-xl bg-secondary px-3 py-2 text-xs font-extrabold">
                        {mine.status === "graded" ? `Scored ${mine.total_score}/${mine.max_score}` : `Submitted · awaiting grading (${mine.auto_score} auto)`}
                      </span>
                    ) : (
                      <button onClick={() => setView({ mode: "take", examId: exam.id })} className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground">Take exam →</button>
                    )}
                  </div>
                </div>

                {isAdmin && !!exam.submissions.length && (
                  <div className="mt-4 rounded-2xl bg-secondary p-3">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Submissions</p>
                    <div className="mt-2 space-y-2">
                      {exam.submissions.map((s: any) => (
                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm font-bold">
                          <span>{s.status === "graded" ? "✅ Graded" : "⏳ Needs grading"} · {s.total_score}/{s.max_score}</span>
                          <button onClick={() => setView({ mode: "grade", submissionId: s.id })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground">Open & grade</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {view.mode === "build" && (
        <section className="card-fun space-y-4 p-5">
          <h2 className="text-xl font-extrabold">{editingId ? "Edit exam" : "New exam"}</h2>
          <label className="block text-sm font-bold">Title<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" /></label>
          <label className="block text-sm font-bold">Description<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-secondary px-3 py-2 font-semibold" /></label>

          {drafts.map((q, i) => (
            <div key={i} className="rounded-2xl border-2 border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">Question {i + 1}</p>
                <div className="flex gap-2">
                  <select value={q.type} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...blank(e.target.value as QType), prompt: x.prompt, marks: x.marks } : x)))} className="rounded-lg border-2 border-border bg-card px-2 py-1 text-xs font-extrabold">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" min={1} value={q.marks} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, marks: Number(e.target.value || 1) } : x)))} className="w-20 rounded-lg border-2 border-border bg-card px-2 py-1 text-xs font-extrabold" title="Marks" />
                  <button onClick={() => setDrafts((p) => p.filter((_, j) => j !== i))} className="rounded-lg bg-berry px-2 py-1 text-xs font-extrabold text-berry-foreground">✕</button>
                </div>
              </div>
              <textarea value={q.prompt} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} placeholder="Question prompt" rows={2} className="mt-3 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold" />
              {q.type === "mcq" && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <label className="block text-xs font-bold">Options (one per line)<textarea value={q.options} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} rows={4} className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold" /></label>
                  <label className="block text-xs font-bold">Correct option<select value={q.correct} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, correct: Number(e.target.value) } : x)))} className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold">{q.options.split("\n").filter(Boolean).map((o, oi) => <option key={oi} value={oi}>{oi + 1}. {o}</option>)}</select></label>
                </div>
              )}
              {q.type === "fill" && <label className="mt-3 block text-xs font-bold">Accepted answers (comma separated)<input value={q.answer} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold" /></label>}
              {q.type === "match" && <label className="mt-3 block text-xs font-bold">Pairs — one per line as Left | Right<textarea value={q.pairs} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, pairs: e.target.value } : x)))} rows={4} className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-mono text-xs font-semibold" /></label>}
              {(q.type === "written" || q.type === "photo" || q.type === "video") && <p className="mt-3 text-xs font-semibold text-muted-foreground">You will grade this one by hand after workers submit.</p>}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDrafts((p) => [...p, blank("mcq")])} className="rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold">＋ Add question</button>
            <button onClick={saveDraft} className="rounded-xl bg-primary px-5 py-2 text-sm font-extrabold text-primary-foreground">Save exam</button>
          </div>
        </section>
      )}

      {view.mode === "take" && <TakeExam code={code} companyId={companyId} exam={(d?.exams ?? []).find((e: any) => e.id === (view as any).examId)} onDone={() => { refresh(); setView({ mode: "list" }); }} />}

      {view.mode === "grade" && <GradeSubmission code={code} companyId={companyId} submissionId={view.submissionId} onDone={() => { refresh(); setView({ mode: "list" }); }} />}
    </main>
  );
}

function TakeExam({ code, companyId, exam, onDone }: { code: string; companyId: string; exam: any; onDone: () => void }) {
  const send = useServerFn(submitExam);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const shuffled = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const q of exam?.questions ?? []) {
      if (q.type === "match") map[q.id] = (q.config?.pairs ?? []).map((p: any) => p.right).sort((a: string, b: string) => a.localeCompare(b));
    }
    return map;
  }, [exam]);

  if (!exam) return <p className="font-bold text-muted-foreground">Exam not found.</p>;

  async function upload(qid: string, file: File) {
    setBusy(true);
    try {
      const path = await uploadToWorkspace(file, { code, companyId, purpose: "answer" });
      setAnswers((a) => ({ ...a, [qid]: { path, name: file.name } }));
      toast.success("Uploaded ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await send({ data: { code, companyId, examId: exam.id, answers } });
      toast.success(r.needsGrading ? `Submitted! ${r.autoScore} marks auto-scored, the rest is with your admin.` : `Submitted! You scored ${r.autoScore}/${r.maxScore} 🎉`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-fun space-y-4 p-5">
      <div>
        <h2 className="text-xl font-extrabold">{exam.title}</h2>
        <p className="text-sm font-semibold text-muted-foreground">{exam.description}</p>
      </div>
      {exam.questions.map((q: any, i: number) => (
        <div key={q.id} className="rounded-2xl border-2 border-border bg-background/60 p-4">
          <p className="font-extrabold">{i + 1}. {q.prompt} <span className="text-xs text-primary">({q.marks} marks · {TYPE_LABELS[q.type as QType]})</span></p>
          {q.type === "mcq" && (
            <div className="mt-3 space-y-2">
              {(q.config?.options ?? []).map((o: string, oi: number) => (
                <label key={oi} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 font-semibold">
                  <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                  {o}
                </label>
              ))}
            </div>
          )}
          {q.type === "fill" && <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer" className="mt-3 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold" />}
          {q.type === "written" && <textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} rows={4} placeholder="Write your answer" className="mt-3 w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-semibold" />}
          {q.type === "match" && (
            <div className="mt-3 space-y-2">
              {(q.config?.pairs ?? []).map((p: any, pi: number) => (
                <div key={pi} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-32 rounded-lg bg-secondary px-3 py-2 text-sm font-extrabold">{p.left}</span>
                  <span>→</span>
                  <select
                    value={(answers[q.id] ?? [])[pi] ?? ""}
                    onChange={(e) => setAnswers((a) => { const arr = [...(a[q.id] ?? [])]; arr[pi] = e.target.value; return { ...a, [q.id]: arr }; })}
                    className="rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-semibold"
                  >
                    <option value="">Choose…</option>
                    {(shuffled[q.id] ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {(q.type === "photo" || q.type === "video") && (
            <div className="mt-3">
              <input type="file" accept={q.type === "photo" ? "image/*" : "video/*"} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(q.id, f); }} className="w-full rounded-xl border-2 border-dashed border-border bg-card px-3 py-2 text-xs font-semibold" />
              {answers[q.id]?.name && <p className="mt-1 text-xs font-bold text-primary">Attached: {answers[q.id].name}</p>}
            </div>
          )}
        </div>
      ))}
      <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "Working…" : "Submit exam 🎯"}</button>
    </section>
  );
}

function GradeSubmission({ code, companyId, submissionId, onDone }: { code: string; companyId: string; submissionId: string; onDone: () => void }) {
  const fetchOne = useServerFn(getSubmission);
  const grade = useServerFn(gradeSubmission);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const q = useQuery({ queryKey: ["submission", submissionId], queryFn: () => fetchOne({ data: { code, companyId, submissionId } }) });

  if (q.isLoading) return <p className="font-bold text-muted-foreground">Loading submission…</p>;
  const s = q.data;
  if (!s) return <p className="font-bold text-muted-foreground">Not found.</p>;

  return (
    <section className="card-fun space-y-4 p-5">
      <div>
        <h2 className="text-xl font-extrabold">{s.examTitle} — {s.workerName}</h2>
        <p className="text-sm font-semibold text-muted-foreground">Auto-scored: {s.submission.auto_score} · Max: {s.submission.max_score}</p>
      </div>
      {s.questions.map((qq: any, i: number) => {
        const answer = (s.submission.answers as any)[qq.id];
        const manual = ["written", "photo", "video"].includes(qq.type);
        return (
          <div key={qq.id} className="rounded-2xl border-2 border-border bg-background/60 p-4">
            <p className="font-extrabold">{i + 1}. {qq.prompt} <span className="text-xs text-primary">({qq.marks} marks)</span></p>
            <div className="mt-2 rounded-xl bg-card p-3 text-sm font-semibold">
              {qq.type === "photo" && s.mediaUrls[qq.id] && <img src={s.mediaUrls[qq.id]!} alt="Worker answer" className="max-h-72 rounded-xl" />}
              {qq.type === "video" && s.mediaUrls[qq.id] && <video src={s.mediaUrls[qq.id]!} controls className="max-h-72 rounded-xl" />}
              {qq.type !== "photo" && qq.type !== "video" && <span className="whitespace-pre-wrap">{Array.isArray(answer) ? answer.join(", ") : qq.type === "mcq" ? (qq.config?.options ?? [])[answer] ?? "—" : String(answer ?? "—")}</span>}
              {(qq.type === "photo" || qq.type === "video") && !s.mediaUrls[qq.id] && <span>No file uploaded</span>}
            </div>
            {manual && (
              <label className="mt-2 block text-xs font-bold">
                Marks awarded (max {qq.marks})
                <input type="number" min={0} max={qq.marks} value={marks[qq.id] ?? 0} onChange={(e) => setMarks((m) => ({ ...m, [qq.id]: Number(e.target.value || 0) }))} className="mt-1 w-28 rounded-lg border-2 border-border bg-card px-3 py-2 font-semibold" />
              </label>
            )}
          </div>
        );
      })}
      <button
        onClick={async () => {
          try {
            const r = await grade({ data: { code, companyId, submissionId, marks } });
            toast.success(`Graded — total ${r.total} marks ✅`);
            onDone();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save the grade.");
          }
        }}
        className="w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground"
      >
        Save grade ✅
      </button>
    </section>
  );
}
