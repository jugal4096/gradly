import {
    collection,
    doc,
    getDoc,
    setDoc,
  } from "firebase/firestore";
  
  import { db } from "../../config/firebase";
  import type { SemesterRecord } from "../../domain/student/semesterRecord.types";
  import type { SubjectResult } from "../../domain/student/subjectResult.types";
  
  const academicRecordsCollection = collection(
    db,
    "academicRecords"
  );
  
  export async function getSemesterRecordById(
    recordId: string
  ): Promise<SemesterRecord | null> {
    const recordRef = doc(
      academicRecordsCollection,
      recordId
    );
  
    const snapshot = await getDoc(recordRef);
  
    if (!snapshot.exists()) {
      return null;
    }
  
    return snapshot.data() as SemesterRecord;
  }
  
  export async function createSemesterRecord(
    record: SemesterRecord
  ): Promise<void> {
    const recordRef = doc(
      academicRecordsCollection,
      record.id
    );
  
    await setDoc(recordRef, record);
  }
  
  export async function createSubjectResult(
    result: SubjectResult
  ): Promise<void> {
    const subjectsCollection = collection(
      db,
      "academicRecords",
      result.semesterRecordId,
      "subjects"
    );
  
    const subjectRef = doc(subjectsCollection, result.id);
  
    await setDoc(subjectRef, result);
  }