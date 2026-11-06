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
type InstitutionRow={code:string;name:string;state:string;district:string;city:string;category:string;institutionType:string;affiliation:string;website:string;management:string;sourceYear:string};

async function main(){
 const file=process.argv[2];if(!file)throw new Error("Usage: npm run import:aishe -- /path/to/aishe-institutions.csv");
 const source=await readFile(file,"utf8"),delimiter=source.split("\n",1)[0].includes("|")?"|":",",rows=parseDelimited(source,delimiter);
 if(rows.length<2)throw new Error("AISHE file contains no data rows.");
 const headers=rows[0].map(normalize);let imported=0,skipped=0;
 const client=await pool.connect();
 const insertSql=(tuples:string[])=>`INSERT INTO public.aishe_institution_directory(aishe_code,name,state,district,city,category,institution_type,affiliation,website,management,source_year,verified,imported_at,updated_at)
 VALUES ${tuples.join(",")}
 ON CONFLICT(aishe_code) DO UPDATE SET name=EXCLUDED.name,state=EXCLUDED.state,district=EXCLUDED.district,city=EXCLUDED.city,category=EXCLUDED.category,institution_type=EXCLUDED.institution_type,affiliation=EXCLUDED.affiliation,website=EXCLUDED.website,management=EXCLUDED.management,source_year=EXCLUDED.source_year,verified=TRUE,updated_at=NOW()`;
 try{
  for(let offset=1;offset<rows.length;offset+=500){
   const batch:InstitutionRow[]=[];
   for(const cells of rows.slice(offset,offset+500)){
    const row:Record<string,string>={};headers.forEach((h,i)=>row[h]=cells[i]||"");
    const code=pick(row,"aishe_code","aisheCode","AISHE Code","institute_code","instituteCode");
    const name=pick(row,"name","institution_name","institute_name","college_name","university_name");
    const state=pick(row,"state","state_name","stateName");
    if(!code||!name||!state){skipped++;continue;}
    batch.push({
     code,name,state,
     district:pick(row,"district","district_name","districtName"),
     city:pick(row,"city","locality","town","city_name"),
     category:pick(row,"category","institution_category","type"),
     institutionType:pick(row,"college_type","standalone_type","university_type","institution_type"),
     affiliation:pick(row,"university_name","affiliation","affiliating_university"),
     website:pick(row,"website","website_url"),
     management:pick(row,"management","ownership","ownership_status"),
     sourceYear:pick(row,"survey_year","source_year","year"),
    });
   }
   if(!batch.length)continue;
   const values:unknown[]=[];
   const tuples=batch.map(item=>{
    const base=values.length;
    values.push(item.code,item.name,item.state,item.district||null,item.city||null,item.category||null,item.institutionType||null,item.affiliation||null,item.website||null,item.management||null,item.sourceYear||null);
    return "("+Array.from({length:11},(_,i)=>"$"+(base+i+1)).join(",")+",TRUE,NOW(),NOW())";
   });
   await client.query("BEGIN");
   try{await client.query(insertSql(tuples),values);await client.query("COMMIT");imported+=batch.length;}
   catch(error){await client.query("ROLLBACK");throw error;}
  }
  process.stdout.write(JSON.stringify({imported,skipped,sourceFile:file})+"\n");
 }finally{client.release();await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
