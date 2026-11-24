import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool, queryWithRetry } from "../../config/database";
import { createTesterToken } from "../../config/jwt";
import { previewEnrollment } from "../academic/enrollment-intelligence.service";
import { TesterAuthenticatedRequest } from "./tester-auth.middleware";
import { discoverGecaEnrollmentCandidates, findGecaEnrollmentResults, listGecaResultSessions } from "./tester-result-sync.service";

export async function loginTester(req: Request, res: Response) {
  const { loginId, password } = req.body ?? {};
  if (typeof loginId !== "string" || !/^[a-zA-Z0-9._-]{3,80}$/.test(loginId.trim()) || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Enter a valid tester ID and password." });
  }
  try {
    const result = await queryWithRetry(
      "SELECT id, login_id, password_hash, status FROM tester_accounts WHERE LOWER(login_id)=LOWER($1) LIMIT 1",
      [loginId.trim()],
    );
    const account = result.rows[0];
    if (!account || account.status !== "ACTIVE" || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ message: "Invalid tester ID or password." });
    }
    await pool.query("UPDATE tester_accounts SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1", [account.id]);
    const token = createTesterToken({ testerId: String(account.id), loginId: account.login_id, role: "TESTER" });
    return res.status(200).json({ token, tester: { loginId: account.login_id } });
  } catch (error) {
    console.error("Tester login failed:", error);
    return res.status(500).json({ message: "Unable to sign in to Tester Mode. Verify the tester account table is available." });
  }
}

async function requireActiveTester(req: TesterAuthenticatedRequest, res: Response): Promise<boolean> {
  const result = await queryWithRetry("SELECT status FROM tester_accounts WHERE id=$1 LIMIT 1", [req.tester?.testerId]);
  if (result.rows[0]?.status === "ACTIVE") return true;
  res.status(401).json({ message: "This tester account is no longer active." });
  return false;
}

export async function getTesterMe(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    return res.json({ tester: { loginId: req.tester?.loginId, role: "TESTER" } });
  } catch {
    return res.status(500).json({ message: "Unable to verify tester account." });
  }
}

/** Read-only academic identity resolution. This endpoint never reads or writes student accounts. */
export async function previewTesterEnrollment(req: TesterAuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId.trim() : "";
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber.trim().toUpperCase() : "";
    if (!institutionId || !enrollmentNumber) {
      res.status(400).json({ success: false, message: "Choose an institution and enter an enrollment number." });
      return;
    }
    const data = await previewEnrollment(institutionId, enrollmentNumber);
    res.status(200).json({ success: true, data, isolated: true, readOnly: true });
  } catch (error) {
    if (error instanceof Error && /^(EMPTY_ENROLLMENT_NUMBER|INVALID_|DSE_ADMISSION_CYCLE_NOT_STARTED|FUTURE_ADMISSION_YEAR|BE_CBCS_DISCONTINUED|BE23_FIRST_YEAR_NOT_ALLOWED|BT_NEP_NOT_STARTED|POSTGRADUATE_REGULAR_ADMISSION_ONLY|ME_CBCS_DISCONTINUED|MT_NEP_NOT_STARTED)/.test(error.message)) {
      res.status(400).json({ success: false, message: "Invalid enrollment number." });
      return;
    }
    console.error("Tester enrollment preview failed:", error);
    res.status(500).json({ success: false, message: "Unable to resolve this test profile right now." });
  }
}



/** Shared course metadata only; tester grades and profiles remain local and isolated. */
export async function listTesterDiscoveredResultSubjects(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const curriculumId = String(req.query.curriculumId || "");
    const codes = String(req.query.codes || "").split(",").map(value => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 100);
    if (!curriculumId || !codes.length) return res.json({ success: true, data: [] });
    const curriculum = await queryWithRetry(
      "SELECT id, institution_id FROM public.curricula WHERE id=$1 LIMIT 1",
      [curriculumId],
    );
    if (!curriculum.rows.length) return res.status(404).json({ success: false, message: "Selected curriculum was not found." });
    const institutionId = curriculum.rows[0].institution_id;
    // Compare result-PDF subjects against the institution-wide catalogue, not
    // only discoveries attached to this one curriculum. A subject such as
    // INMDM1002 may already be known through another GECA programme/curriculum.
    // Keep the selected curriculum's own rows highest priority, then other
    // GECA curriculum rows, then the shared discovered registry and canonical
    // institution subject catalogue.
    const result = await queryWithRetry(
      `WITH candidates AS (
         SELECT cs.course_code AS "courseCode", cs.course_name AS "courseName",
                cs.credits, CASE WHEN cs.curriculum_id=$3::uuid THEN 1 ELSE 2 END AS priority, 'CURRICULUM'::text AS source
         FROM public.curriculum_subjects cs
         JOIN public.curricula c ON c.id=cs.curriculum_id
         WHERE c.institution_id=$1
           AND EXISTS (
             SELECT 1 FROM regexp_split_to_table(upper(cs.course_code), '[^A-Z0-9]+') AS parts(code_part)
             WHERE regexp_replace(parts.code_part,'[^A-Z0-9]','','g')=ANY($2::text[])
           )
         UNION ALL
         SELECT drs.course_code AS "courseCode", drs.course_name AS "courseName",
                drs.credits, CASE WHEN drs.curriculum_id=$3::uuid THEN 3 ELSE 4 END AS priority, 'DISCOVERED'::text AS source
         FROM public.discovered_result_subjects drs
         JOIN public.curricula c ON c.id=drs.curriculum_id
         WHERE c.institution_id=$1
           AND EXISTS (
             SELECT 1 FROM regexp_split_to_table(upper(drs.course_code), '[^A-Z0-9]+') AS parts(code_part)
             WHERE regexp_replace(parts.code_part,'[^A-Z0-9]','','g')=ANY($2::text[])
           )
         UNION ALL
         SELECT s.canonical_code AS "courseCode", s.canonical_name AS "courseName",
                NULL::numeric AS credits, 5 AS priority, 'SUBJECT'::text AS source
         FROM public.subjects s
         WHERE s.institution_id=$1
           AND regexp_replace(upper(s.canonical_code),'[^A-Z0-9]','','g')=ANY($2::text[])
       )
       SELECT DISTINCT ON (regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'))
              "courseCode", "courseName", credits, source
       FROM candidates
       ORDER BY regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'), priority ASC, "courseName" ASC`,
      [institutionId, codes, curriculumId],
    );
    return res.json({ success: true, data: result.rows, sharedCatalogue: true, catalogueScope: "INSTITUTION", testerProfileIsolated: true });
  } catch (error) {
    console.error("Tester discovered subject lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load the shared discovered subject catalogue." });
  }
}

export async function confirmTesterDiscoveredResultSubject(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const curriculumId = String(req.body?.curriculumId || "");
    const courseCode = String(req.body?.courseCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const courseName = String(req.body?.courseName || "").trim().slice(0, 180);
    const requestedCategory = String(req.body?.courseCategory || "UNCLASSIFIED").toUpperCase().slice(0, 24);
    const inferredCategory = courseCode.startsWith("ETHS") ? "HSSM"
      : courseCode.startsWith("CEOE") ? "OE"
      : courseCode.startsWith("ITPC") ? "PCC"
      : courseCode.startsWith("ITPE") ? "PEC"
      : courseCode.startsWith("ITES") ? "ESC"
      : courseCode.startsWith("MABS") ? "BSC"
      : courseCode === "ITHS1030" ? "HSSM"
      : courseCode.startsWith("ITHS") ? "AEC"
      : courseCode.startsWith("INHS") ? "VEC"
      : courseCode.startsWith("ITMD") ? "MDM"
      : courseCode.startsWith("MEOE") || courseCode.startsWith("CEOE") ? "OE"
      : "UNCLASSIFIED";
    const courseCategory = requestedCategory === "UNCLASSIFIED" ? inferredCategory : requestedCategory;
    const credits = Number(req.body?.credits);
    const semesterNumber = Number(req.body?.semesterNumber);
    if (!curriculumId || !/^[A-Z0-9]{4,16}$/.test(courseCode) || courseName.length < 2 || !Number.isFinite(credits) || credits < 0 || credits > 30 || !Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
      return res.status(400).json({ success: false, message: "Enter a valid curriculum, course code, subject name, semester and credit value." });
    }
    const curriculum = await queryWithRetry("SELECT id FROM public.curricula WHERE id=$1 LIMIT 1", [curriculumId]);
    if (!curriculum.rows.length) return res.status(404).json({ success: false, message: "Selected curriculum was not found." });
    const inserted = await pool.query(
      `INSERT INTO public.discovered_result_subjects
        (curriculum_id, course_code, course_name, course_category, credits, credit_status, confirmed_by, source, semester_number)
       VALUES ($1,$2,$3,$4,$5,'FIRST_USER_CONFIRMED',NULL,'TESTER_OFFICIAL_RESULT_PDF',$6)
       ON CONFLICT (curriculum_id, course_code) DO NOTHING
       RETURNING course_code AS "courseCode", course_name AS "courseName", course_category AS "courseCategory", credits, credit_status AS "creditStatus", semester_number AS "semesterNumber"`,
      [curriculumId, courseCode, courseName, courseCategory, credits, semesterNumber],
    );
    const row = inserted.rows[0] || (await queryWithRetry(
      `SELECT course_code AS "courseCode", course_name AS "courseName", course_category AS "courseCategory", credits, credit_status AS "creditStatus", semester_number AS "semesterNumber"
       FROM public.discovered_result_subjects WHERE curriculum_id=$1 AND course_code=$2 LIMIT 1`,
      [curriculumId, courseCode],
    )).rows[0];
    return res.status(inserted.rowCount ? 201 : 200).json({ success: true, created: Boolean(inserted.rowCount), data: row, sharedCatalogue: true, testerProfileIsolated: true });
  } catch (error) {
    console.error("Tester discovered subject registration failed:", error);
    return res.status(500).json({ success: false, message: "Unable to register the discovered subject in the shared catalogue." });
  }
}

/** Tester-only result archive discovery. This does not touch student accounts or saved records. */
export async function listTesterGecaResultSessions(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const sessions = await listGecaResultSessions();
    return res.status(200).json({ success: true, sessions, source: "GECA_OFFICIAL_RESULT_ARCHIVE", readOnly: true });
  } catch (error) {
    console.error("Tester GECA result archive lookup failed:", error);
    return res.status(502).json({ success: false, message: error instanceof Error ? error.message : "Unable to load GECA examination sessions." });
  }
}


/** Discover real enrollment numbers from selected GECA result PDFs; no serials are fabricated. */
export async function discoverTesterEnrollmentCandidates(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const resultId=String(req.body?.resultId||"");
    const programme=String(req.body?.programme||"").toUpperCase();
    const admissionYear=Number(req.body?.admissionYear);
    const admissionMode=String(req.body?.admissionMode||"").toUpperCase();
    const branchCode=String(req.body?.branchCode||"");
    const semester=Number(req.body?.semester);
    const limit=Math.min(60,Math.max(1,Number(req.body?.limit)||60));
    const result=await discoverGecaEnrollmentCandidates({resultId,programme,admissionYear,admissionMode:admissionMode as "F"|"S",branchCode,semester,limit});
    return res.status(200).json({success:true,...result,readOnly:true,isolated:true,source:"GECA_OFFICIAL_RESULT_PDFS"});
  } catch(error) {
    const message=error instanceof Error?error.message:"Unable to discover eligible enrollment numbers.";
    const status=/Invalid GECA result session|Choose a supported|selected examination session/i.test(message)?400:502;
    console.error("Tester enrollment candidate discovery failed:",error);
    return res.status(status).json({success:false,message});
  }
}

/** Search every PDF linked under one selected exam session for the isolated tester enrollment. */
export async function matchTesterGecaResult(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const resultId = String(req.params.resultId || "");
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber.trim().toUpperCase() : "";
    const selectedSemester = Number(req.body?.selectedSemester);
    if (!enrollmentNumber) return res.status(400).json({ success: false, message: "Tester enrollment number is required." });
    const reExamTargetCourseCode = typeof req.body?.reExamTargetCourseCode === "string" ? req.body.reExamTargetCourseCode.trim() : undefined;
    const result = await findGecaEnrollmentResults(
      resultId,
      enrollmentNumber,
      Number.isInteger(selectedSemester) && selectedSemester >= 1 && selectedSemester <= 12 ? selectedSemester : undefined,
      reExamTargetCourseCode,
    );
    return res.status(200).json({ success: true, ...result, enrollmentNumber, readOnly: true, isolated: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect the selected examination result.";
    const status = /valid enrollment|selected examination session|Invalid GECA result session/i.test(message) ? 400 : 502;
    console.error("Tester GECA result matching failed:", error);
    return res.status(status).json({ success: false, message });
  }
}
