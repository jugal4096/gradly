import { readFile } from "node:fs/promises";
import { pool } from "../config/database";

function parseDelimited(source:string,delimiter:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
 for(let i=0;i<source.length;i++){const ch=source[i];
  if(ch==='"'){if(quoted&&source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(ch===delimiter&&!quoted){row.push(field);field="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&source[i+1]==="\n")i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field="";}
  else field+=ch;
 }
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
function pick(row:Record<string,string>,...names:string[]){for(const name of names){const value=row[normalize(name)];if(value?.trim()&&value.trim()!=="-")return value.trim();}return "";}
async function main(){
 const file=process.argv[2];if(!file)throw new Error("Usage: npm run import:aishe -- /path/to/aishe-institutions.csv");
 const source=await readFile(file,"utf8"),delimiter=source.split("\n",1)[0].includes("|")?"|":",",rows=parseDelimited(source,delimiter);
 if(rows.length<2)throw new Error("AISHE file contains no data rows.");
 const headers=rows[0].map(normalize);let imported=0,skipped=0;
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  for(let offset=1;offset<rows.length;offset+=400){
   for(const cells of rows.slice(offset,offset+400)){
    const row:Record<string,string>={};headers.forEach((h,i)=>row[h]=cells[i]||"");
    const code=pick(row,"aishe_code","aisheCode","AISHE Code","institute_code","instituteCode");
    const name=pick(row,"name","institution_name","institute_name","college_name","university_name");
    const state=pick(row,"state","state_name","stateName");
    if(!code||!name||!state){skipped++;continue;}
    const district=pick(row,"district","district_name","districtName");
    const city=pick(row,"city","locality","town","city_name");
    const category=pick(row,"category","institution_category","type");
    const institutionType=pick(row,"college_type","standalone_type","university_type","institution_type");
    const affiliation=pick(row,"university_name","affiliation","affiliating_university");
    const website=pick(row,"website","website_url");
    const management=pick(row,"management","ownership","ownership_status");
    const sourceYear=pick(row,"survey_year","source_year","year");
    await client.query(
     `INSERT INTO public.aishe_institution_directory(aishe_code,name,state,district,city,category,institution_type,affiliation,website,management,source_year,verified,imported_at,updated_at)
      VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),TRUE,NOW(),NOW())
      ON CONFLICT(aishe_code) DO UPDATE SET name=EXCLUDED.name,state=EXCLUDED.state,district=EXCLUDED.district,city=EXCLUDED.city,category=EXCLUDED.category,institution_type=EXCLUDED.institution_type,affiliation=EXCLUDED.affiliation,website=EXCLUDED.website,management=EXCLUDED.management,source_year=EXCLUDED.source_year,verified=TRUE,updated_at=NOW()`,
     [code,name,state,district,city,category,institutionType,affiliation,website,management,sourceYear]
    );imported++;
   }
  }
  await client.query("COMMIT");
  process.stdout.write(JSON.stringify({imported,skipped,sourceFile:file})+"\n");
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
