import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

type Column = { column_name: string; is_nullable: string; column_default: string | null; is_identity: string; is_generated: string };
async function insertRecord(client: any, table: string, fields: Record<string, unknown>) {
  const meta = await client.query("SELECT column_name,is_nullable,column_default,is_identity,is_generated FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table]);
  const columns: Column[] = meta.rows;
  if (!columns.length) throw new Error(`Table public.${table} does not exist.`);
  const valid = new Set(columns.map(c => c.column_name));
  const entries = Object.entries(fields).filter(([key,value]) => valid.has(key) && value !== undefined);
  const supplied = new Set(entries.map(([key]) => key));
  const missing = columns.filter(c => c.is_nullable === "NO" && c.column_default === null && c.is_identity !== "YES" && c.is_generated !== "ALWAYS" && !supplied.has(c.column_name));
  if (missing.length) throw new Error(`Database requires fields not supported by this form for ${table}: ${missing.map(c => c.column_name).join(", ")}.`);
  if (!entries.length) throw new Error(`No compatible columns found for ${table}.`);
  const result = await client.query(`INSERT INTO public."${table}" (${entries.map(([key])=>`"${key}"`).join(",")}) VALUES (${entries.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`, entries.map(([,value])=>value));
  return result.rows[0];
}

export async function createInstitutionManually(req: SuperAdminAuthenticatedRequest, res: Response) {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const country = typeof body.country === "string" && body.country.trim() ? body.country.trim() : "India";
  const programName = typeof body.programName === "string" ? body.programName.trim() : "";
  const programCode = typeof body.programCode === "string" ? body.programCode.trim() : "";
  const programLevel = typeof body.programLevel === "string" ? body.programLevel.trim() : "";
  const branchName = typeof body.branchName === "string" ? body.branchName.trim() : "";
  const branchCode = typeof body.branchCode === "string" ? body.branchCode.trim() : "";
  if (name.length < 2 || name.length > 200) return res.status(400).json({ success:false, message:"Institution name must be 2–200 characters." });
  if (Boolean(programName) !== Boolean(branchName)) return res.status(400).json({ success:false, message:"Enter both program and branch, or leave both blank." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const duplicate = await client.query("SELECT id FROM public.institutions WHERE LOWER(name)=LOWER($1) LIMIT 1", [name]);
    if (duplicate.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({success:false,message:"An institution with this name already exists."}); }
    const institution = await insertRecord(client,"institutions",{name,city:city||undefined,location_city:city||undefined,locality:city||undefined,state:state||undefined,region:state||undefined,country,location:[city,state,country].filter(Boolean).join(", ")||undefined});
    let program = null, branch = null;
    if (programName) {
      program = await insertRecord(client,"programs",{institution_id:institution.id,name:programName,code:programCode||undefined,level:programLevel||undefined,active:true,status:"ACTIVE"});
      branch = await insertRecord(client,"branches",{program_id:program.id,institution_id:institution.id,name:branchName,code:branchCode||undefined,active:true,status:"ACTIVE"});
    }
    await client.query("COMMIT");
    return res.status(201).json({success:true,message:"Institution created successfully.",institution,program,branch});
  } catch (error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    console.error("Manual institution creation failed:",error);
    return res.status(400).json({success:false,message:error instanceof Error?error.message:"Could not create institution."});
  } finally { client.release(); }
}

export async function createSyllabusManually(req: SuperAdminAuthenticatedRequest, res: Response) {
  const body = req.body ?? {};
  const institutionId = String(body.institutionId || "").trim(), programId = String(body.programId || "").trim(), branchId = String(body.branchId || "").trim();
  const version = String(body.version || "1").trim(), semesterCount = Number(body.semesterCount);
  const raw = typeof body.subjectsText === "string" ? body.subjectsText : "";
  if (!institutionId || !programId || !branchId) return res.status(400).json({success:false,message:"Select institution, program and branch."});
  if (!Number.isInteger(semesterCount) || semesterCount < 1 || semesterCount > 16) return res.status(400).json({success:false,message:"Semester count must be between 1 and 16."});
  const subjects = [];
  for (const [index,line] of raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).entries()) {
    const [semesterText,code="",name="",creditsText,type="CORE"] = line.split("|").map(v=>v.trim());
    const semester = Number(semesterText), credits = Number(creditsText);
    if (!Number.isInteger(semester)||semester<1||semester>semesterCount||!name||!Number.isFinite(credits)||credits<0||credits>50) return res.status(400).json({success:false,message:`Line ${index+1}: use semester | code | subject name | credits | optional type.`});
    subjects.push({semester,code,name,credits,type:type||"CORE"});
  }
  if (!subjects.length || subjects.length>500) return res.status(400).json({success:false,message:"Add between 1 and 500 subject rows."});
  const client = await pool.connect();
  try {
    const scope = await client.query("SELECT i.id institution_id,p.id program_id,b.id branch_id FROM public.institutions i JOIN public.programs p ON p.institution_id=i.id JOIN public.branches b ON b.program_id=p.id WHERE i.id::text=$1 AND p.id::text=$2 AND b.id::text=$3 LIMIT 1",[institutionId,programId,branchId]);
    if (!scope.rowCount) return res.status(400).json({success:false,message:"Institution, program and branch do not match."});
    await client.query("BEGIN");
    const curriculumFields: Record<string, unknown> = {institution_id:scope.rows[0].institution_id,program_id:scope.rows[0].program_id,branch_id:scope.rows[0].branch_id,version: Number(version) || 1,total_semesters:semesterCount,status:"ACTIVE",name:version,total_credits:subjects.reduce((s,x)=>s+x.credits,0)};
    const curriculumMeta = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='curricula' AND is_nullable='NO' AND column_default IS NULL");
    const referenceTables: Record<string,string> = {scheme_id:"schemes",academic_year_id:"academic_years",grading_system_id:"grading_systems",specialization_id:"specializations",admission_mode_id:"admission_modes"};
    for (const row of curriculumMeta.rows as Array<{column_name:string}>) {
      const column = row.column_name;
      if (column in curriculumFields || !referenceTables[column]) continue;
      const ref = await client.query(`SELECT id FROM public."${referenceTables[column]}" ORDER BY id LIMIT 1`);
      if (!ref.rowCount) throw new Error(`Add at least one record to public.${referenceTables[column]} before creating a syllabus.`);
      curriculumFields[column] = ref.rows[0].id;
    }
    const curriculum = await insertRecord(client,"curricula",curriculumFields);
    const semesters = [];
    for(let n=1;n<=semesterCount;n++) {
      const rows = subjects.filter(x=>x.semester===n);
      semesters.push(await insertRecord(client,"semesters",{curriculum_id:curriculum.id,semester_number:n,semester_no:n,name:`Semester ${n}`,expected_credits:rows.reduce((s,x)=>s+x.credits,0)}));
    }
    for(const subject of subjects) {
      const existing = await client.query(
        "SELECT id FROM public.subjects s WHERE ($1 <> '' AND LOWER(COALESCE(to_jsonb(s)->>'code',to_jsonb(s)->>'subject_code',to_jsonb(s)->>'course_code',''))=LOWER($1)) OR LOWER(COALESCE(to_jsonb(s)->>'name',to_jsonb(s)->>'subject_name',to_jsonb(s)->>'title',''))=LOWER($2) LIMIT 1",
        [subject.code, subject.name]
      );
      const savedSubject = existing.rowCount ? existing.rows[0] : await insertRecord(client,"subjects",{name:subject.name,subject_name:subject.name,title:subject.name,code:subject.code||undefined,subject_code:subject.code||undefined,course_code:subject.code||undefined});
      await insertRecord(client,"curriculum_subjects",{curriculum_id:curriculum.id,semester_id:semesters[subject.semester-1].id,subject_id:savedSubject.id,course_id:savedSubject.id,course_code:subject.code||undefined,course_name:subject.name,credits:subject.credits,course_type:subject.type,mandatory:true,active:true});
    }
    await client.query("COMMIT");
    return res.status(201).json({success:true,message:`Syllabus created: ${semesterCount} semesters, ${subjects.length} subjects.`,curriculumId:curriculum.id});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    console.error("Manual syllabus creation failed:",error);
    return res.status(400).json({success:false,message:error instanceof Error?error.message:"Could not create syllabus."});
  } finally { client.release(); }
}
