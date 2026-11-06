import type { Request, Response } from "express";
import { pool } from "../../config/database";
import { firebaseAuth } from "../../config/firebase-admin";

type Item = { id:string; name:string; aisheCode?:string; city:string; state:string; country:string; website:string|null; type:string; source:string; isInGradly:boolean; externalId?:string; branches?:unknown[] };
const cache = new Map<string,{until:number;items:Item[];count:number}>();
const clean=(v:unknown,n=160)=>typeof v==="string"?v.trim().slice(0,n):"";

export async function discoverInstitutions(req:Request,res:Response) {
 const q=clean(req.query.q,120),state=clean(req.query.state,100),city=clean(req.query.city,100),district=clean(req.query.district,100),affiliation=clean(req.query.affiliation,120),type=clean(req.query.type,60);
 const page=Math.max(1,Math.min(400,Number(req.query.page)||1)),limit=Math.max(5,Math.min(30,Number(req.query.limit)||20));
 if(q.length<2&&!state&&!city&&!district&&!affiliation&&!type)return res.json({institutions:[],page,limit,hasMore:false,sources:["Gradly directory","OpenAlex (supplementary)"]});
 const key=JSON.stringify({q,state,city,district,affiliation,type,page,limit}),hit=cache.get(key);
 if(hit&&hit.until>Date.now())return res.json({institutions:hit.items,page,limit,hasMore:hit.count>page*8,cached:true,sources:["AISHE · Ministry of Education (when imported)","Gradly directory","OpenAlex (supplementary)"]});
 try {
  const values:unknown[]=[],where:string[]=[];
  const add=(v:unknown)=>{values.push(v);return "$"+values.length;};
  if(q)where.push("i.name ILIKE "+add("%"+q+"%"));
  if(state)where.push("COALESCE(to_jsonb(i)->>'state','') ILIKE "+add("%"+state+"%"));
  if(city)where.push("COALESCE(to_jsonb(i)->>'city','') ILIKE "+add("%"+city+"%"));
  if(district)where.push("COALESCE(to_jsonb(i)->>'district','') ILIKE "+add("%"+district+"%"));
  if(affiliation)where.push("COALESCE(to_jsonb(i)->>'affiliation','') ILIKE "+add("%"+affiliation+"%"));
  if(type)where.push("(COALESCE(to_jsonb(i)->>'institution_type','')||' '||COALESCE(to_jsonb(i)->>'type','')) ILIKE "+add("%"+type+"%"));
  const local=await pool.query(
   "SELECT i.id::text AS id,i.name,COALESCE(to_jsonb(i)->>'city','') AS city,COALESCE(to_jsonb(i)->>'state','') AS state,COALESCE(to_jsonb(i)->>'website',to_jsonb(i)->>'website_url') AS website,COALESCE(to_jsonb(i)->>'institution_type',to_jsonb(i)->>'type','') AS type,COALESCE(branch_data.branches,'[]'::jsonb) AS branches FROM public.institutions i LEFT JOIN LATERAL (SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id',b.id,'name',b.name,'code',b.code,'program_id',p.id,'program_name',p.name,'program_level',p.level)) FILTER(WHERE b.id IS NOT NULL),'[]'::jsonb) AS branches FROM public.programs p LEFT JOIN public.branches b ON b.program_id=p.id WHERE p.institution_id=i.id) branch_data ON TRUE "+(where.length?"WHERE "+where.join(" AND "):"")+" ORDER BY i.name LIMIT 8 OFFSET "+((page-1)*8),
   values
  );
  const locals:Item[]=local.rows.map((r:any)=>({id:String(r.id),name:r.name,city:r.city,state:r.state,country:"India",website:r.website||null,type:r.type||"Higher education institution",source:"Gradly directory",isInGradly:true,branches:r.branches||[]}));
  let aisheItems:Item[]=[];let aisheCount=0;
  try{
   const av:unknown[]=[];const aw:string[]=[];const aa=(v:unknown)=>{av.push(v);return "$"+av.length;};
   if(q)aw.push("name ILIKE "+aa("%"+q+"%"));
   if(state)aw.push("state ILIKE "+aa("%"+state+"%"));
   if(city)aw.push("COALESCE(city,'') ILIKE "+aa("%"+city+"%"));
   if(district)aw.push("COALESCE(district,'') ILIKE "+aa("%"+district+"%"));
   if(affiliation)aw.push("COALESCE(affiliation,'') ILIKE "+aa("%"+affiliation+"%"));
   if(type)aw.push("(COALESCE(category,'')||' '||COALESCE(institution_type,'')) ILIKE "+aa("%"+type+"%"));
   const clause=aw.length?" WHERE "+aw.join(" AND "):"";
   const rows=await pool.query("SELECT aishe_code,name,state,district,city,category,institution_type,affiliation,website FROM public.aishe_institution_directory"+clause+" ORDER BY name LIMIT 8 OFFSET "+((page-1)*8),av);
   const countResult=await pool.query("SELECT COUNT(*)::int AS count FROM public.aishe_institution_directory"+clause,av);
   aisheCount=Number(countResult.rows[0]?.count||0);
   aisheItems=rows.rows.map((x:any)=>({id:"AISHE:"+x.aishe_code,externalId:"AISHE:"+x.aishe_code,aisheCode:x.aishe_code,name:x.name,city:x.city||"",state:x.state||"",country:"India",website:x.website||null,type:x.institution_type||x.category||"Higher education institution",source:"AISHE · Ministry of Education",isInGradly:false}));
  }catch(e){console.warn("AISHE directory is not available yet; apply the AISHE migration and import the official directory export.",e);}
  const terms=[q,city,district,affiliation,state].filter(Boolean).join(" ");
  const params=new URLSearchParams({search:terms||"higher education",filter:"country_code:IN,type:education",select:"id,display_name,geo,country_code,homepage_url,type","per-page":"8",page:String(page)});
  const response=await fetch("https://api.openalex.org/institutions?"+params,{headers:{Accept:"application/json","User-Agent":"Gradly/1.0 institution discovery"},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error("Supplementary institution provider unavailable");
  const data=await response.json() as {meta?:{count?:number};results?:Array<{id?:string;display_name?:string;geo?:{city?:string|null;region?:string|null};homepage_url?:string|null;type?:string|null}>};
  const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,""),names=new Set([...locals,...aisheItems].map(x=>norm(x.name)));
  const external:Item[]=(data.results||[]).map(x=>({id:x.id||"",externalId:x.id||"",name:clean(x.display_name,200),city:clean(x.geo?.city,100),state:clean(x.geo?.region,100),country:"India",website:x.homepage_url||null,type:clean(x.type,60)||"Higher education institution",source:"OpenAlex (supplementary)",isInGradly:names.has(norm(clean(x.display_name,200)))})).filter(x=>x.id&&x.name&&(!state||x.state.toLowerCase().includes(state.toLowerCase()))&&(!city||x.city.toLowerCase().includes(city.toLowerCase()))&&(!type||x.type.toLowerCase().includes(type.toLowerCase())));
  const merged=[...locals,...aisheItems,...external.filter(x=>!names.has(norm(x.name)))].slice(0,limit),count=Math.max(Number(data.meta?.count||0),aisheCount,local.rows.length===8?page*8+1:0);
  cache.set(key,{until:Date.now()+600000,items:merged,count});
  if(cache.size>500)for(const [k,v] of cache)if(v.until<Date.now())cache.delete(k);
  return res.json({institutions:merged,page,limit,hasMore:count>page*8,sources:["AISHE · Ministry of Education (when imported)","Gradly directory","OpenAlex (supplementary; not a complete official Indian register)"]});
 } catch(e){console.error("Institution discovery failed",e);return res.status(502).json({message:"Institution discovery is temporarily unavailable. You can still request an institution to be added.",institutions:[],page,limit,hasMore:false});}
}

export async function submitInstitutionRequest(req:Request,res:Response) {
 const name=clean(req.body?.institutionName||req.body?.collegeName,160),state=clean(req.body?.state,100),city=clean(req.body?.city,100),district=clean(req.body?.district,100),type=clean(req.body?.institutionType,80),affiliation=clean(req.body?.affiliation,180),website=clean(req.body?.website,240),info=clean(req.body?.additionalInfo,2000),externalId=clean(req.body?.externalInstitutionId,200),guestId=clean(req.body?.guestId,24);
 if(name.length<2||!state||!city||!type)return res.status(400).json({message:"Institution name, state, city and type are required."});
 if(website&&!/^https?:\/\//i.test(website))return res.status(400).json({message:"Website must begin with http:// or https://."});
 if(/[<>]/.test([name,state,city,district,affiliation,info].join(" ")))return res.status(400).json({message:"Please remove unsupported characters."});
 let uid:string|null=null,email:string|null=null,requester:string|null=null;
 if(req.headers.authorization?.startsWith("Bearer ")){try{const d=await firebaseAuth.verifyIdToken(req.headers.authorization.slice(7));uid=d.uid;email=d.email||null;requester=d.name||null;}catch{return res.status(401).json({message:"Sign-in session expired. Please sign in again."});}}
 const locality=[city,district].filter(Boolean).join(", ").slice(0,160),client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext(lower($1)))",[name]);
  const exists=await client.query("SELECT id,name FROM public.institutions WHERE lower(regexp_replace(name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace($1,'[^a-zA-Z0-9]','','g')) LIMIT 1",[name]);
  if(exists.rowCount){await client.query("ROLLBACK");return res.status(409).json({code:"INSTITUTION_ALREADY_EXISTS",message:"This institution is already in the Gradly directory.",institution:exists.rows[0]});}
  const duplicate=await client.query("SELECT id,status FROM public.guest_institution_requests WHERE lower(regexp_replace(college_name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace($1,'[^a-zA-Z0-9]','','g')) AND lower(locality)=lower($2) AND lower(state)=lower($3) AND status IN ('PENDING','IN_REVIEW') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[name,locality,state]);
  if(duplicate.rowCount){await client.query("COMMIT");return res.status(200).json({message:"A request for this institution is already under review.",request:duplicate.rows[0],duplicate:true});}
  const result=await client.query("INSERT INTO public.guest_institution_requests(college_name,locality,guest_id,external_institution_id,source,status,state,city,district,institution_type,affiliation,website,additional_info,requester_uid,requester_email,requester_name) VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),'STUDENT_DISCOVERY','PENDING',$5,$6,NULLIF($7,''),$8,NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),$12,$13,$14) RETURNING id,college_name AS \"institutionName\",locality,state,city,district,institution_type AS \"institutionType\",affiliation,website,additional_info AS \"additionalInfo\",status,created_at AS \"createdAt\"",[name,locality,guestId,externalId,state,city,district,type,affiliation,website,info,uid,email,requester]);
  await client.query("COMMIT");return res.status(201).json({message:"Your institution request has been submitted for Super Admin review.",request:result.rows[0]});
 }catch(e){await client.query("ROLLBACK");console.error("Institution request submission failed",e);return res.status(503).json({message:"We couldn't save your request. Please try again later."});}finally{client.release();}
}

export async function getInstitutionRequestStatus(req:Request,res:Response) {
 const id=clean(req.params.requestId,80);if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({message:"Invalid request ID."});
 try{const r=await pool.query("SELECT id,college_name AS \"institutionName\",state,city,district,institution_type AS \"institutionType\",status,created_at AS \"createdAt\",reviewed_at AS \"reviewedAt\",reviewed_note AS \"reviewNote\" FROM public.guest_institution_requests WHERE id=$1 LIMIT 1",[id]);if(!r.rowCount)return res.status(404).json({message:"Request not found."});return res.json({request:r.rows[0]});}
 catch(e){console.error(e);return res.status(500).json({message:"Unable to retrieve request status."});}
}

export async function reviewInstitutionRequest(req:Request,res:Response) {
 const sa=(req as Request&{superAdmin?:{superAdminId?:string}}).superAdmin?.superAdminId,status=clean(req.body?.status,20).toUpperCase(),note=clean(req.body?.reviewNote,2000);
 if(!sa)return res.status(401).json({success:false,message:"Super Admin authentication required."});
 if(!["APPROVED","REJECTED","IN_REVIEW"].includes(status)||note.length<3)return res.status(400).json({success:false,message:"Choose a valid action and provide a review note."});
 const client=await pool.connect();
 try{
  await client.query("BEGIN");const found=await client.query("SELECT * FROM public.guest_institution_requests WHERE id=$1 FOR UPDATE",[req.params.requestId]);
  if(!found.rowCount){await client.query("ROLLBACK");return res.status(404).json({success:false,message:"Institution request not found."});}
  const item=found.rows[0];if(["APPROVED","REJECTED"].includes(item.status)){await client.query("ROLLBACK");return res.status(409).json({success:false,message:"This request has already been closed."});}
  let directoryId:string|null=null;
  if(status==="APPROVED"){
   const aisheCode=String(item.external_institution_id||"").startsWith("AISHE:")?String(item.external_institution_id).slice(6):null;
   const metadata=[item.state||null,item.city||null,item.district||null,item.institution_type||null,item.affiliation||null,item.website||null,aisheCode];
   const duplicate=await client.query("SELECT id FROM public.institutions WHERE lower(regexp_replace(name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace($1,'[^a-zA-Z0-9]','','g')) LIMIT 1",[item.college_name]);
   if(duplicate.rowCount){
    const updatedDirectory=await client.query("UPDATE public.institutions SET state=COALESCE(NULLIF(state,''),$2),city=COALESCE(NULLIF(city,''),$3),district=COALESCE(NULLIF(district,''),$4),institution_type=COALESCE(NULLIF(institution_type,''),$5),affiliation=COALESCE(NULLIF(affiliation,''),$6),website=COALESCE(NULLIF(website,''),$7),aishe_code=COALESCE(NULLIF(aishe_code,''),$8) WHERE id=$1 RETURNING id",[duplicate.rows[0].id,...metadata]);
    directoryId=updatedDirectory.rows[0].id;
   }else{
    const created=await client.query("INSERT INTO public.institutions(name,state,city,district,institution_type,affiliation,website,aishe_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[item.college_name,...metadata]);
    directoryId=created.rows[0].id;
   }
  }
  const updated=await client.query("UPDATE public.guest_institution_requests SET status=$2,reviewed_at=CASE WHEN $2 IN ('APPROVED','REJECTED') THEN NOW() ELSE reviewed_at END,reviewed_by_super_admin_id=$3,reviewed_note=$4,directory_institution_id=$5 WHERE id=$1 RETURNING id,status,reviewed_at,reviewed_note,directory_institution_id",[req.params.requestId,status,sa,note,directoryId]);
  await client.query("COMMIT");return res.json({success:true,message:status==="APPROVED"?"Institution approved and added to Gradly directory.":status==="REJECTED"?"Institution request rejected.":"Request moved to review.",request:updated.rows[0]});
 }catch(e){await client.query("ROLLBACK");console.error("Institution request review failed",e);return res.status(500).json({success:false,message:"Unable to review institution request."});}finally{client.release();}
}
