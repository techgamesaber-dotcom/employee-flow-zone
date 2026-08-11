import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authorizeCompany, db, MANUAL_TYPES, requireAdmin, scoreQuestion, signPath, type QuestionRow } from "@/lib/access.server";

export const listExams = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
  }))
  .handler(async ({ data }) => {
    const { worker } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    const { data: exams, error } = await d
      .from("exams")
      .select("id, title, description, is_published, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const visible = (exams ?? []).filter((e) => worker.is_admin || e.is_published);
    const ids = visible.map((e) => e.id);
    const questions = ids.length
      ? (await d.from("exam_questions").select("id, exam_id, position, type, prompt, config, answer_key, marks").in("exam_id", ids).order("position")).data ?? []
      : [];
    const subsQuery = d.from("exam_submissions").select("id, exam_id, worker_id, auto_score, manual_score, total_score, max_score, status, submitted_at");
    const submissions = ids.length
      ? ((worker.is_admin ? await subsQuery.in("exam_id", ids) : await subsQuery.in("exam_id", ids).eq("worker_id", worker.id)).data ?? [])
      : [];
    return {
      isAdmin: worker.is_admin,
      workerId: worker.id,
      exams: visible.map((e) => {
        const qs = questions.filter((q) => q.exam_id === e.id);
        return {
          ...e,
          maxScore: qs.reduce((s, q) => s + Number(q.marks), 0),
          questionCount: qs.length,
          questions: qs.map((q) => ({
            id: q.id,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            marks: q.marks,
            config: q.config,
            // The answer key never leaves the server for workers.
            answer_key: worker.is_admin ? q.answer_key : null,
          })),
          submissions: submissions.filter((s) => s.exam_id === e.id),
        };
      }),
    };
  });

export const saveExam = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id?: string | undefined; title: string; description?: string; questions: { type: string; prompt: string; marks: number; config?: Record<string, unknown>; answerKey?: Record<string, unknown> }[] }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    id: input.id ? z.string().uuid().parse(input.id) : undefined,
    title: z.string().trim().min(1).max(150).parse(input.title),
    description: z.string().trim().max(2000).parse(input.description ?? ""),
    questions: z
      .array(
        z.object({
          type: z.enum(["mcq", "fill", "written", "match", "photo", "video"]),
          prompt: z.string().trim().min(1).max(2000),
          marks: z.number().int().min(1).max(100),
          config: z.record(z.any()).default({}),
          answerKey: z.record(z.any()).default({}),
        }),
      )
      .min(1)
      .max(100)
      .parse(input.questions),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    let examId = data.id;
    if (examId) {
      const { error } = await d
        .from("exams")
        .update({ title: data.title, description: data.description, updated_at: new Date().toISOString() })
        .eq("id", examId)
        .eq("company_id", data.companyId);
      if (error) throw new Error(error.message);
      await d.from("exam_questions").delete().eq("exam_id", examId);
    } else {
      const { data: row, error } = await d
        .from("exams")
        .insert({ company_id: data.companyId, title: data.title, description: data.description })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      examId = row.id;
    }
    const { error: qError } = await d.from("exam_questions").insert(
      data.questions.map((q, i) => ({
        exam_id: examId!,
        position: i,
        type: q.type,
        prompt: q.prompt,
        marks: q.marks,
        config: q.config as never,
        answer_key: q.answerKey as never,
      })),
    );
    if (qError) throw new Error(qError.message);
    return { id: examId! };
  });

export const setExamPublished = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string; published: boolean }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    id: z.string().uuid().parse(input.id),
    published: z.boolean().parse(input.published),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const { error } = await d.from("exams").update({ is_published: data.published }).eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; id: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    id: z.string().uuid().parse(input.id),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const { error } = await d.from("exams").delete().eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const submitExam = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; examId: string; answers: Record<string, unknown> }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    examId: z.string().uuid().parse(input.examId),
    answers: z.record(z.any()).parse(input.answers),
  }))
  .handler(async ({ data }) => {
    const { worker } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    const { data: exam, error: examError } = await d
      .from("exams")
      .select("id, is_published")
      .eq("id", data.examId)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (examError) throw new Error(examError.message);
    if (!exam || !exam.is_published) throw new Error("This exam is not open");
    const { data: questions, error: qError } = await d
      .from("exam_questions")
      .select("id, type, prompt, config, answer_key, marks, position")
      .eq("exam_id", data.examId)
      .order("position");
    if (qError) throw new Error(qError.message);
    const rows = (questions ?? []) as unknown as QuestionRow[];
    let auto = 0;
    let needsGrading = false;
    for (const q of rows) {
      const score = scoreQuestion(q, data.answers[q.id]);
      if (score === null) needsGrading = true;
      else auto += score;
    }
    const max = rows.reduce((s, q) => s + Number(q.marks), 0);
    const { error } = await d.from("exam_submissions").upsert(
      {
        exam_id: data.examId,
        worker_id: worker.id,
        answers: data.answers as never,
        auto_score: auto,
        manual_score: 0,
        total_score: auto,
        max_score: max,
        status: needsGrading ? "submitted" : "graded",
        submitted_at: new Date().toISOString(),
        graded_at: needsGrading ? null : new Date().toISOString(),
      },
      { onConflict: "exam_id,worker_id" },
    );
    if (error) throw new Error(error.message);
    return { autoScore: auto, maxScore: max, needsGrading };
  });

export const getSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; submissionId: string }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    submissionId: z.string().uuid().parse(input.submissionId),
  }))
  .handler(async ({ data }) => {
    const { worker } = await authorizeCompany(data.code, data.companyId);
    const d = await db();
    const { data: sub, error } = await d
      .from("exam_submissions")
      .select("id, exam_id, worker_id, answers, auto_score, manual_score, total_score, max_score, status")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Submission not found");
    if (!worker.is_admin && sub.worker_id !== worker.id) throw new Error("Not allowed");
    const { data: exam } = await d.from("exams").select("id, title, company_id").eq("id", sub.exam_id).maybeSingle();
    if (!exam || exam.company_id !== data.companyId) throw new Error("Not allowed");
    const { data: questions } = await d
      .from("exam_questions")
      .select("id, type, prompt, config, answer_key, marks, position")
      .eq("exam_id", sub.exam_id)
      .order("position");
    const answers = (sub.answers ?? {}) as Record<string, any>;
    const resolved: Record<string, string | null> = {};
    for (const q of questions ?? []) {
      if (MANUAL_TYPES.includes(q.type) && answers[q.id] && typeof answers[q.id]?.path === "string") {
        resolved[q.id] = await signPath(answers[q.id].path);
      }
    }
    const { data: workerRow } = await d.from("workers").select("name").eq("id", sub.worker_id).maybeSingle();
    return {
      submission: { ...sub, answers },
      examTitle: exam.title,
      workerName: workerRow?.name ?? "Worker",
      mediaUrls: resolved,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        marks: q.marks,
        config: q.config,
        answer_key: worker.is_admin ? q.answer_key : null,
      })),
    };
  });

export const gradeSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; companyId: string; submissionId: string; marks: Record<string, number> }) => ({
    code: z.string().trim().min(2).max(40).parse(input.code),
    companyId: z.string().uuid().parse(input.companyId),
    submissionId: z.string().uuid().parse(input.submissionId),
    marks: z.record(z.number().min(0).max(100)).parse(input.marks),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.code, data.companyId);
    const d = await db();
    const { data: sub, error } = await d
      .from("exam_submissions")
      .select("id, exam_id, auto_score")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Submission not found");
    const { data: exam } = await d.from("exams").select("company_id").eq("id", sub.exam_id).maybeSingle();
    if (!exam || exam.company_id !== data.companyId) throw new Error("Not allowed");
    const { data: questions } = await d.from("exam_questions").select("id, type, marks").eq("exam_id", sub.exam_id);
    let manual = 0;
    for (const q of questions ?? []) {
      if (!MANUAL_TYPES.includes(q.type)) continue;
      manual += Math.min(Number(data.marks[q.id] ?? 0), Number(q.marks));
    }
    const total = Number(sub.auto_score) + manual;
    const { error: upError } = await d
      .from("exam_submissions")
      .update({ manual_score: manual, total_score: total, status: "graded", graded_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (upError) throw new Error(upError.message);
    return { total };
  });
