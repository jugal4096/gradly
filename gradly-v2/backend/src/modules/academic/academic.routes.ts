import { Router, Request, Response } from "express";
import { pool } from "../../config/database";

const router = Router();

/** Search Gradly's configured institutions and optional external Places results. */
router.get("/institutions/search", async (req: Request, res: Response): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) {
    res.status(200).json({ success: true, data: [], externalData: [], externalSearchAvailable: Boolean(process.env.GOOGLE_PLACES_API_KEY) });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT i.id AS institution_id, i.name AS institution_name,
              i.city AS institution_city, i.state AS institution_state,
              i.country AS institution_country,
              b.id AS branch_id, b.name AS branch_name, b.code AS branch_code,
              p.id AS program_id, p.name AS program_name, p.level AS program_level
       FROM institutions i
       LEFT JOIN programs p ON p.institution_id = i.id AND p.active = TRUE
       LEFT JOIN branches b ON b.program_id = p.id AND b.active = TRUE
       WHERE i.active = TRUE
         AND (i.name ILIKE $1 OR COALESCE(i.city, '') ILIKE $1 OR COALESCE(i.state, '') ILIKE $1)
       ORDER BY i.name, p.name, b.name
       LIMIT 160`,
      [`%${query}%`],
    );
    const map = new Map<string, { id: string; name: string; city: string | null; state: string | null; country: string; branches: Array<{ id: string; name: string; code: string | null; program_id: string; program_name: string; program_level: string | null }> }>();
    for (const row of result.rows) {
      if (!map.has(row.institution_id)) map.set(row.institution_id, {
        id: row.institution_id, name: row.institution_name,
        city: row.institution_city, state: row.institution_state,
        country: row.institution_country, branches: [],
      });
      if (row.branch_id) map.get(row.institution_id)!.branches.push({
        id: row.branch_id, name: row.branch_name, code: row.branch_code,
        program_id: row.program_id, program_name: row.program_name, program_level: row.program_level,
      });
    }
    const configured = Array.from(map.values());
    let externalData: Array<{ id: string; name: string; address: string; city: string | null; state: string | null; mapsUrl: string | null }> = [];
    const placesKey = process.env.GOOGLE_PLACES_API_KEY;
    if (placesKey) {
      try {
        const placesResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": placesKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
          },
          body: JSON.stringify({ textQuery: query, pageSize: 8 }),
          signal: AbortSignal.timeout(5000),
        });
        if (placesResponse.ok) {
          const placesPayload = await placesResponse.json() as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; googleMapsUri?: string }> };
          const configuredNames = new Set(configured.map(item => item.name.trim().toLowerCase()));
          externalData = (placesPayload.places || [])
            .filter(place => place.id && place.displayName?.text && !configuredNames.has(place.displayName.text.trim().toLowerCase()))
            .map(place => {
              const address = place.formattedAddress || "";
              const parts = address.split(",").map(part => part.trim()).filter(Boolean);
              return {
                id: place.id!,
                name: place.displayName!.text!,
                address,
                city: parts.length >= 2 ? parts[parts.length - 3] || parts[0] : parts[0] || null,
                state: parts.length >= 2 ? parts[parts.length - 2] : null,
                mapsUrl: place.googleMapsUri || null,
              };
            });
        } else {
          console.error("Google Places institution search returned:", placesResponse.status);
        }
      } catch (error) {
        console.error("Google Places institution search unavailable:", error);
      }
    }
    res.status(200).json({
      success: true,
      data: configured,
      externalData,
      externalSearchAvailable: Boolean(placesKey),
    });
  } catch (error) {
    console.error("Institution search failed:", error);
    res.status(500).json({ success: false, message: "Unable to search institutions." });
  }
});

router.get(
  "/institutions",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(`
        SELECT
          i.id AS institution_id,
          i.name AS institution_name,
          b.id AS branch_id,
          b.name AS branch_name,
          b.code AS branch_code,
          p.id AS program_id,
          p.name AS program_name,
          p.level AS program_level
        FROM institutions i
        INNER JOIN programs p
          ON p.institution_id = i.id
        INNER JOIN branches b
          ON b.program_id = p.id
        ORDER BY
          i.name ASC,
          b.name ASC;
      `);

      const institutionsMap = new Map<
        string,
        {
          id: string;
          name: string;
          branches: {
            id: string;
            name: string;
            code?: string | null;
            program_id: string;
            program_name: string;
            program_level?: string | null;
          }[];
        }
      >();

      for (const row of result.rows) {
        if (!institutionsMap.has(row.institution_id)) {
          institutionsMap.set(row.institution_id, {
            id: row.institution_id,
            name: row.institution_name,
            branches: [],
          });
        }

        institutionsMap
          .get(row.institution_id)!
          .branches.push({
            id: row.branch_id,
            name: row.branch_name,
            code: row.branch_code,
            program_id: row.program_id,
            program_name: row.program_name,
            program_level: row.program_level,
          });
      }

      const institutions = Array.from(
        institutionsMap.values()
      );

      res.status(200).json({
        success: true,
        data: institutions,
      });
    } catch (error) {
      console.error(
        "GET /api/academic/institutions error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to load academic master data.",
      });
    }
  }
);



/** Available curricula for a selected institution/program/branch. */
router.get("/curricula", async (req: Request, res: Response): Promise<void> => {
  const { institutionId, programId, branchId } = req.query;
  if (typeof institutionId !== "string" || typeof programId !== "string" || typeof branchId !== "string") {
    res.status(400).json({ success: false, message: "Institution, programme and branch are required." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT c.id, c.version, c.status, c.total_semesters, c.total_credits,
              c.scheme_id, sc.name AS scheme_name, sc.code AS scheme_code,
              COUNT(DISTINCT sem.id)::int AS configured_semesters
       FROM curricula c
       LEFT JOIN schemes sc ON sc.id = c.scheme_id
       LEFT JOIN semesters sem ON sem.curriculum_id = c.id
       WHERE c.institution_id = $1 AND c.program_id = $2 AND c.branch_id = $3
       GROUP BY c.id, sc.name, sc.code
       ORDER BY c.version DESC NULLS LAST, sc.name ASC`,
      [institutionId, programId, branchId],
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET /api/academic/curricula error:", error);
    res.status(500).json({ success: false, message: "Failed to load curricula." });
  }
});

/** Available enrollment modes for a programme, including institution-specific overrides and global defaults. */
router.get("/admission-modes", async (req: Request, res: Response): Promise<void> => {
  const { institutionId, programmePrefix } = req.query;
  if (typeof institutionId !== "string" || typeof programmePrefix !== "string" || !/^(BE|BT|MC|MT)$/.test(programmePrefix)) {
    res.status(400).json({ success: false, message: "Institution and programme prefix are required." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (mode_code) id, mode_code, mode_name, entry_semester
       FROM enrollment_admission_modes
       WHERE (institution_id = $1 OR institution_id IS NULL)
         AND (programme_prefix = $2 OR programme_prefix IS NULL)
       ORDER BY mode_code, (institution_id = $1) DESC NULLS LAST,
                (programme_prefix = $2) DESC NULLS LAST`,
      [institutionId, programmePrefix],
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET /api/academic/admission-modes error:", error);
    res.status(500).json({ success: false, message: "Failed to load admission modes." });
  }
});

/** Curriculum subjects for a specific semester, used by the student manual-entry form. */
router.get("/curricula/:curriculumId/semesters/:semesterNumber/subjects", async (req: Request, res: Response): Promise<void> => {
  const { curriculumId, semesterNumber } = req.params;
  const number = Number(semesterNumber);
  if (!Number.isInteger(number) || number < 1 || number > 12) {
    res.status(400).json({ success: false, message: "Invalid semester number." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.course_code AS code, cs.course_name AS name,
              cs.credits, cs.course_type AS "courseType", cs.mandatory,
              sem.id AS "semesterId", sem.semester_number AS semester
       FROM curriculum_subjects cs
       JOIN semesters sem ON sem.id = cs.semester_id
       WHERE cs.curriculum_id = $1 AND sem.semester_number = $2
         AND cs.active = TRUE
       ORDER BY cs.course_code, cs.course_name`,
      [curriculumId, number],
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET curriculum subjects error:", error);
    res.status(500).json({ success: false, message: "Failed to load curriculum subjects." });
  }
});

export default router;